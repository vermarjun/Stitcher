# syntax=docker/dockerfile:1.7
#
# Multi-stage build:
#   1. base       — python3.11 + system deps (manim, ffmpeg, latex, bubblewrap)
#   2. pydeps     — install Python deps into /opt/venv, ARG-selectable storage extras
#   3. seccomp    — compile the seccomp-bpf policy into a binary blob
#   4. runtime    — copy the venv + app + seccomp blob into a small final image
#
# The storage extras are selected at BUILD time via `--build-arg STORAGE=cloudinary`
# (or s3, gcs, azure, or "" for local-only). This keeps the image as thin as each
# deployment actually needs — a local-only build is ~200MB smaller than the full one.

ARG PY_VERSION=3.11

# ---------- stage 1: base ----------
FROM python:${PY_VERSION}-slim-bookworm AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System libraries:
#   - ffmpeg                : video mux + thumbnail extraction
#   - libcairo2, libpango1.0 : manim renderer backend
#   - texlive-latex-base + texlive-fonts-recommended + texlive-latex-extra + dvisvgm
#                           : MathTex support (keep this fat; removing it breaks equations)
#   - bubblewrap            : sandbox runtime
#   - libseccomp2           : bwrap needs this even if we don't enable seccomp
#   - python3-seccomp    : bindings for scripts/build_seccomp.py (build stage only)
#   - build-essential pkg-config libcairo2-dev libpango1.0-dev : manim wheel compile
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
      texlive-latex-base texlive-fonts-recommended texlive-latex-extra \
      texlive-science dvisvgm \
      bubblewrap libseccomp2 \
      sox \
      build-essential pkg-config libcairo2-dev libpango1.0-dev \
      curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------- stage 2: pydeps ----------
FROM base AS pydeps

ARG STORAGE=""

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /build
COPY pyproject.toml README.md ./
COPY app/ ./app/
# Baked-in offline voiceover package. `pip install .` builds the wheel from
# [tool.hatch.build.targets.wheel] packages = ["app", "stitcher_voiceover"], so
# `from stitcher_voiceover import OfflineTTS` works inside /opt/venv at render time.
COPY stitcher_voiceover/ ./stitcher_voiceover/
# Vendored Manim plugins (patched source trees — see vendor/<name>/).
COPY vendor/ ./vendor/

# Install base + selected storage extra(s) into the venv. Quoting handles an empty STORAGE.
RUN if [ -n "$STORAGE" ]; then \
      pip install ".[${STORAGE}]"; \
    else \
      pip install "."; \
    fi

# ---------- vendored Manim plugins ----------
# Install with --no-deps to avoid moving manim off 0.19.2; then add real
# third-party deps for each plugin explicitly.
#
# Build deps: poetry-core is needed for manim-chess and manim-physics (which
# use poetry as build backend); setuptools_scm for manim-chemistry.
RUN pip install "poetry-core>=1.0.0" "setuptools_scm>=6.2" "setuptools>=65"

# 1. manim-chess — no third-party deps besides manim
RUN pip install --no-deps ./vendor/manim-chess

# 2. manim-physics — deps: pymunk, shapely
RUN pip install --no-deps ./vendor/manim-physics && \
    pip install "pymunk>=6.6.0" "shapely>=2.0.3"

# 3. manim-chemistry — deps: pandas, xmltodict, requests, scipy
#    (numpy already present from manim; setuptools_scm for dynamic version)
#    SETUPTOOLS_SCM_PRETEND_VERSION prevents setuptools-scm from failing because
#    the vendor/ tree has no .git history.
RUN SETUPTOOLS_SCM_PRETEND_VERSION_FOR_MANIM_CHEMISTRY=0.5.0 \
    pip install --no-deps ./vendor/manim-chemistry && \
    pip install "pandas>=1.5" "xmltodict>=0.13" "requests>=2.28" "scipy>=1.9"

# 4. manim-ml — deps: numpy, Pillow, scipy (numpy + scipy already installed)
RUN pip install --no-deps ./vendor/manim-ml && \
    pip install "Pillow>=9.0"

# 5. manim-dsa — deps: networkx, typing_extensions (both already via manim)
RUN pip install --no-deps ./vendor/manim-dsa

# 6. manim-astronomy — deps: vedo (pulls vtk ~100 MB, can be flaky).
#    Install with a timeout; failure here must NOT abort the build.
#    The other 5 plugins are already installed above, so this is truly last.
RUN pip install --no-deps ./vendor/manim-astronomy && \
    ( pip install "vedo>=2025.0" || \
      echo "WARNING: vedo/vtk install failed — HubbleSpaceTelescope and JamesWebbSpaceTelescope will be unavailable; Star/Planet/SpaceTimeFabric still work." )

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
# Note: seccomp-BPF compilation is optional and skipped here because Debian bookworm arm64
# doesn't ship python3-seccomp with the libseccomp python bindings. The sandbox layer
# degrades gracefully when SANDBOX_SECCOMP_POLICY_PATH is unset — namespaces + rlimits
# remain the primary boundary. To enable seccomp, see docs/SANDBOX.md and run
# `scripts/build_seccomp.py` on a host that has libseccomp python bindings installed,
# then COPY the resulting .bpf into the image yourself.

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
