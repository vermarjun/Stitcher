# v3/Dockerfile
FROM python:3.11-slim

# OS deps needed for manim rendering 
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    wget \
    ca-certificates \
    pkg-config \
    cmake \
    ffmpeg \
    imagemagick \
    ghostscript \
    dvipng \
    poppler-utils \
    \
    # Cairo / Pango / GDK for manim cairo backend
    libcairo2 \
    libcairo2-dev \
    libpango-1.0-0 \
    libpango1.0-dev \
    libgdk-pixbuf-2.0-0 \
    libgdk-pixbuf-2.0-dev \
    \
    # font libraries
    fonts-lmodern \
    fonts-dejavu \
    \
    # image libs
    libpng-dev \
    libjpeg-dev \
    zlib1g-dev \
    \
    # build helpers
    libffi-dev \
    libssl-dev \
    \
    # Minimal TeX packages for MathTex/Tex
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-xetex \
    texlive-fonts-extra \
    texlive-lang-english \
    cm-super \
    \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


# Create app directory
WORKDIR /app

# Copy requirements first (for caching)
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the rest of the code
COPY . /app

# Ensure python can import `app` package at /app
ENV PYTHONPATH=/app

# Default command overridden by docker-compose command
CMD ["bash", "-lc", "uvicorn app.main:app"]