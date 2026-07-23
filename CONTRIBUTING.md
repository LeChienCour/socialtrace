# Contributing to socialtrace

## Dev setup

Requires: Python 3.12, [uv](https://docs.astral.sh/uv/), Node 20+,
[pnpm](https://pnpm.io/), [Podman](https://podman.io/) (or Docker) with
Compose Spec support.

```sh
# backend
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn socialtrace.main:app --reload

# frontend (separate terminal)
cd frontend
pnpm install
pnpm dev
```

Or the full stack via containers:

```sh
cp .env.example .env
podman compose up --build
```

The app is then available at `http://localhost:8080`.

## Running tests

```sh
cd backend
uv run pytest -v
```

Tests spin up a real PostgreSQL instance via `testcontainers` — never
SQLite. This requires a working Podman/Docker socket; see the
`DOCKER_HOST` env var if `testcontainers` can't find your Podman machine's
socket.

## Before opening a PR

```sh
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy --strict src
cd frontend && pnpm lint && pnpm build
```

All of the above run in CI; a red CI run will block merge either way.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), in English,
imperative mood: `fix: correct engagement rate denominator for TikTok`,
`feat(tasks): add unified capture tray endpoint`.

## Schema changes

Write the Alembic migration in the same commit as the model change it
corresponds to — never let them drift apart. `alembic revision
--autogenerate` from `backend/` after editing a model.

## Code and language

All code, comments, docs, and commit messages are in English. (User-facing
i18n for es/en is planned for a later phase — that's a separate concern from
the language the codebase itself is written in.)
