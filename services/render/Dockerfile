# syntax=docker/dockerfile:1.7
#
# Multi-stage build:
#   1. base       — python3.11 + system deps (manim, ffmpeg, latex, bubblewrap)
#   2. pydeps     — install Python deps into /opt/venv, ARG-selectable storage extras
#   3. runtime    — copy the venv + app into the final image
#
# Build args:
#   STORAGE=cloudinary  installs the cloudinary extra (default "" = local storage only).
#   PIP_INDEX_URL=URL   Python package index for the uv installs (default "" = PyPI).
#   APT_MIRROR=URL      replaces http://deb.debian.org in the apt sources (default "" = unchanged),
#                       e.g. --build-arg APT_MIRROR=http://cdn-aws.deb.debian.org
#   SLIM=1              skips texlive-science and vedo/vtk. Smaller image, but MathTex
#                       loses packages such as siunitx and mhchem, and the astronomy
#                       plugin loses HubbleSpaceTelescope and JamesWebbSpaceTelescope.

ARG PY_VERSION=3.11
ARG SLIM=0
ARG APT_MIRROR=""

# ---------- stage 1: base ----------
FROM python:${PY_VERSION}-slim-bookworm AS base

ARG SLIM
ARG APT_MIRROR

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10

# System libraries:
#   - ffmpeg                : video mux + thumbnail extraction
#   - libcairo2, libpango1.0 : manim renderer backend
#   - texlive-latex-base + texlive-fonts-recommended + texlive-latex-extra + dvisvgm
#                           : MathTex support (keep this fat; removing it breaks equations)
#   - texlive-science       : extra LaTeX packages (siunitx, mhchem); skipped when SLIM=1
#   - bubblewrap            : sandbox runtime
#   - libseccomp2           : bwrap links against it
#   - build-essential pkg-config libcairo2-dev libpango1.0-dev : manim wheel compile
RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i "s|http://deb.debian.org|${APT_MIRROR%/}|g" /etc/apt/sources.list.d/debian.sources; \
    fi \
    && apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
      texlive-latex-base texlive-fonts-recommended texlive-latex-extra \
      dvisvgm \
      bubblewrap libseccomp2 \
      sox \
      build-essential pkg-config libcairo2-dev libpango1.0-dev \
      curl ca-certificates \
    && if [ "$SLIM" != "1" ]; then apt-get install -y --no-install-recommends texlive-science; fi \
    && rm -rf /var/lib/apt/lists/*

# ---------- stage 2: pydeps ----------
FROM base AS pydeps

ARG STORAGE=""
ARG SLIM
ARG PIP_INDEX_URL=""

# uv downloads wheels in parallel, which matters on slow or high-latency links. The venv
# is still a normal `python -m venv` one (with pip), so pip works inside the final image.
# uv itself comes from PyPI (pinned); the ghcr.io image is unreachable on some networks.
RUN if [ -n "$PIP_INDEX_URL" ]; then pip install --index-url "$PIP_INDEX_URL" uv==0.11.0; \
    else env -u PIP_INDEX_URL pip install uv==0.11.0; fi
ENV UV_CONCURRENT_DOWNLOADS=16 \
    UV_HTTP_TIMEOUT=300 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_CACHE_DIR=/root/.cache/uv
# `pipi <args>` = `uv pip install` into /opt/venv, honouring the optional PIP_INDEX_URL.
RUN printf '%s\n' '#!/bin/sh' \
      'exec uv pip install --python /opt/venv/bin/python ${PIP_INDEX_URL:+--index-url "$PIP_INDEX_URL"} "$@"' \
      > /usr/local/bin/pipi && chmod +x /usr/local/bin/pipi

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /build
COPY pyproject.toml README.md ./
COPY app/ ./app/
# Baked-in offline voiceover package. `pipi .` builds the wheel from
# [tool.hatch.build.targets.wheel] packages = ["app", "stitcher_voiceover"], so
# `from stitcher_voiceover import OfflineTTS` works inside /opt/venv at render time.
COPY stitcher_voiceover/ ./stitcher_voiceover/
# Vendored Manim plugins (patched source trees — see vendor/<name>/).
COPY vendor/ ./vendor/

# Install base + selected storage extra(s) into the venv. Quoting handles an empty STORAGE.
RUN --mount=type=cache,target=/root/.cache/uv \
    if [ -n "$STORAGE" ]; then \
      pipi ".[${STORAGE}]"; \
    else \
      pipi "."; \
    fi

# ---------- vendored Manim plugins ----------
# Install with --no-deps to avoid moving manim off 0.19.2; then add real
# third-party deps for each plugin explicitly.
#
# Build deps: poetry-core is needed for manim-chess and manim-physics (which
# use poetry as build backend); setuptools_scm for manim-chemistry.
RUN --mount=type=cache,target=/root/.cache/uv pipi "poetry-core>=1.0.0" "setuptools_scm>=6.2" "setuptools>=65"

# 1. manim-chess — no third-party deps besides manim
RUN --mount=type=cache,target=/root/.cache/uv pipi --no-deps ./vendor/manim-chess

# 2. manim-physics — deps: pymunk, shapely
RUN --mount=type=cache,target=/root/.cache/uv pipi --no-deps ./vendor/manim-physics && \
    pipi "pymunk>=6.6.0" "shapely>=2.0.3"

# 3. manim-chemistry — deps: pandas, xmltodict, requests, scipy
#    (numpy already present from manim; setuptools_scm for dynamic version)
#    SETUPTOOLS_SCM_PRETEND_VERSION prevents setuptools-scm from failing because
#    the vendor/ tree has no .git history.
RUN --mount=type=cache,target=/root/.cache/uv SETUPTOOLS_SCM_PRETEND_VERSION_FOR_MANIM_CHEMISTRY=0.5.0 \
    pipi --no-deps ./vendor/manim-chemistry && \
    pipi "pandas>=1.5" "xmltodict>=0.13" "requests>=2.28" "scipy>=1.9"

# 4. manim-ml — deps: numpy, Pillow, scipy (numpy + scipy already installed)
RUN --mount=type=cache,target=/root/.cache/uv pipi --no-deps ./vendor/manim-ml && \
    pipi "Pillow>=9.0"

# 5. manim-dsa — deps: networkx, typing_extensions (both already via manim)
RUN --mount=type=cache,target=/root/.cache/uv pipi --no-deps ./vendor/manim-dsa

# 6. manim-astronomy — deps: vedo (pulls vtk ~100 MB, can be flaky).
#    Failure here must NOT abort the build, and SLIM=1 skips vedo on purpose.
#    The other 5 plugins are already installed above, so this is truly last.
RUN --mount=type=cache,target=/root/.cache/uv pipi --no-deps ./vendor/manim-astronomy && \
    if [ "$SLIM" = "1" ]; then \
      echo "SLIM=1: skipping vedo/vtk. HubbleSpaceTelescope and JamesWebbSpaceTelescope will be unavailable."; \
    else \
      pipi "vedo>=2025.0" || \
      echo "WARNING: vedo/vtk install failed — HubbleSpaceTelescope and JamesWebbSpaceTelescope will be unavailable; Star/Planet/SpaceTimeFabric still work."; \
    fi

# Manim 0.19 SVGMobject.generate_mobject() writes a modified copy of each SVG
# *next to the source file* before parsing. Plugin packages install SVGs into
# site-packages which is root-owned and not writable by the renderer user at
# runtime. Making those directories group/world-writable here (in the pydeps
# stage, before the runtime COPY --from=pydeps) lets the renderer user write
# the temporary SVG without needing /tmp or a Manim config change.
RUN find /opt/venv/lib/python3.11/site-packages/manim_chess \
         /opt/venv/lib/python3.11/site-packages/manim_Astronomy \
         -type d -exec chmod a+rwx {} + 2>/dev/null || true

# ---------- stage 3: runtime ----------
# No seccomp filter is applied. The sandbox boundary is bwrap namespaces plus rlimits.
# See docs/SANDBOX.md for what is and is not enforced.

FROM base AS runtime

# Drop build-only packages to keep the image small.
RUN apt-get purge -y --auto-remove build-essential pkg-config libcairo2-dev libpango1.0-dev && \
    rm -rf /var/lib/apt/lists/*

COPY --from=pydeps  /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:${PATH}" \
    MANIM_PATH=/opt/venv/bin/manim \
    PYTHON_PATH=/opt/venv/bin/python \
    FFMPEG_PATH=/usr/bin/ffmpeg

WORKDIR /srv
COPY app/ ./app/

# Non-root user for the API process. The sandboxed manim process inside runs as
# --uid 99999 via bwrap, independent of this user.
RUN useradd --system --uid 10001 --home-dir /srv --shell /usr/sbin/nologin renderer && \
    mkdir -p /tmp/renders && chown -R renderer:renderer /tmp/renders /srv
USER renderer

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health >/dev/null || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
