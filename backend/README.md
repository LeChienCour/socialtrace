# socialtrace backend

FastAPI + SQLAlchemy 2.0 + Alembic. See repo root README for full project context.

## Dev setup

```
uv sync
uv run alembic upgrade head
uv run uvicorn socialtrace.main:app --reload
```

## Tests

```
uv run pytest -v
```

Tests use `testcontainers` to spin up a real PostgreSQL instance — no SQLite, ever.
