FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src/ src/
COPY alembic/ alembic/
COPY alembic.ini README.md ./
RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runtime

RUN useradd --system --create-home --uid 1000 socialtrace

WORKDIR /app
COPY --from=builder --chown=socialtrace:socialtrace /app /app

ENV PATH="/app/.venv/bin:$PATH"

USER socialtrace

EXPOSE 8000

CMD ["uvicorn", "socialtrace.main:app", "--host", "0.0.0.0", "--port", "8000"]
