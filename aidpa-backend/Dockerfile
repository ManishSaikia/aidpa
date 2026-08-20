# ─ Stage 1: dependency builder ───────────────────────────────────────────────
# The official uv image ships with Python 3.13 + uv pre-installed.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

WORKDIR /app

# Copy manifests first so Docker can cache the dep-install layer.
# A source-code change will NOT re-run `uv sync` unless deps change.
COPY pyproject.toml uv.lock ./

# UV_LINK_MODE=copy: required in multi-stage builds (no hard-links across layers).
# --frozen:              never modify the lock file inside the image.
# --no-dev:              skip test/lint dependencies.
# --no-install-project:  only install deps, not the project package itself.
ENV UV_LINK_MODE=copy
RUN uv sync --frozen --no-dev --no-install-project

# ─ Stage 2: lean runtime image ───────────────────────────────────────────────
FROM python:3.13-slim AS runtime

WORKDIR /app

# Copy the pre-built virtual environment from the builder stage.
COPY --from=builder /app/.venv /app/.venv

# Copy application source (respects .dockerignore — secrets and .venv excluded).
COPY . .

# Activate the venv for all subsequent commands and for CMD.
ENV PATH="/app/.venv/bin:$PATH"

# Unbuffered stdout so logs appear in Railway dashboard in real time.
# No .pyc files — container is ephemeral anyway.
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Railway injects $PORT dynamically; fall back to 8000 for local docker run.
EXPOSE 8000
CMD ["sh", "-c", "fastapi run main.py --host 0.0.0.0 --port ${PORT:-8000}"]
