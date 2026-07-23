# 5. Tooling choices: uv, pnpm, ruff/mypy strict, biome

## Status

Accepted

## Context

The spec mandates the frameworks (FastAPI, SQLAlchemy 2.0, React, Vite) and
quality bar (ruff, mypy strict, biome) but not every package manager. These
are lower-stakes than the architectural ADRs above, bundled into one entry.

## Decision

- **uv** for the backend: single lockfile (`uv.lock`), fast installs, good
  Docker layer caching via `uv sync --frozen`.
- **pnpm** for the frontend: fast, disk-efficient, standard for Vite-based
  projects.
- **ruff** + **mypy strict** for backend linting/typing — matches the spec
  exactly, no debate here.
- **biome** for frontend linting/formatting — matches the spec, replaces the
  Vite scaffold's default `oxlint` (removed).

## Consequences

Contributors need `uv` and `pnpm` installed locally (documented in
`CONTRIBUTING.md`). Neither choice is load-bearing for the architecture —
either could be swapped for `pip`/`poetry` or `npm` without touching any
application code, only `pyproject.toml`/`package.json` and CI.
