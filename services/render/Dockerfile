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
#   - python3-libseccomp    : bindings for scripts/build_seccomp.py (build stage only)
#   - build-essential pkg-config libcairo2-dev libpango1.0-dev : manim wheel compile
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
      texlive-latex-base texlive-fonts-recommended texlive-latex-extra \
      texlive-science dvisvgm \
      bubblewrap libseccomp2 \
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

# Install base + selected storage extra(s) into the venv. Quoting handles an empty STORAGE.
RUN if [ -n "$STORAGE" ]; then \
      pip install ".[${STORAGE}]"; \
    else \
      pip install "."; \
    fi

# ---------- stage 3: seccomp ----------
FROM base AS seccomp

RUN apt-get update && apt-get install -y --no-install-recommends python3-libseccomp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY app/assets/seccomp_manim.yaml ./policy.yaml
COPY scripts/build_seccomp.py ./build_seccomp.py
RUN pip install --break-system-packages pyyaml && \
    python build_seccomp.py --policy policy.yaml --out seccomp_manim.bpf

# ---------- stage 4: runtime ----------
FROM base AS runtime

# Drop build-only packages to keep the image small.
RUN apt-get purge -y --auto-remove build-essential pkg-config libcairo2-dev libpango1.0-dev && \
    rm -rf /var/lib/apt/lists/*

COPY --from=pydeps  /opt/venv /opt/venv
COPY --from=seccomp /build/seccomp_manim.bpf /etc/manim-render-service/seccomp_manim.bpf

ENV PATH="/opt/venv/bin:${PATH}" \
    SANDBOX_SECCOMP_POLICY_PATH=/etc/manim-render-service/seccomp_manim.bpf \
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
