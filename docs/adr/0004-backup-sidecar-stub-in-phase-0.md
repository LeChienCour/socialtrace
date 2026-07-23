# 4. Backup sidecar exists as a stub from phase 0

## Status

Accepted

## Context

The prototype this project replaces ran backups via an HTTP endpoint that
shelled out to `pg_dump` as a subprocess: no auth, blocks the event loop,
forces a `postgresql-client` OS package into the backend image, and opens an
argument-injection surface. The correct design — a separate cron+`pg_dump`
sidecar container writing to its own volume with a retention policy — is
scoped to phase 5.

The open question was whether the sidecar's *compose service* should exist in
phase 0 (scaffolding) or wait until phase 5 (when its actual logic is built).

## Decision

Include `backup` in `compose.yaml` from phase 0, as a genuine no-op stub
(entrypoint logs a message and sleeps, exits cleanly on `SIGTERM`). It has:

- its own named volume (`backup_data`), so the volume topology is decided
  once, not renegotiated later against `db`'s existing mounts;
- a `depends_on: db (service_healthy)` only — nothing else depends on it, so
  it can never block the rest of the stack from becoming healthy;
- no shared image or dependency with `backend`, so the constraint "backend
  image never bundles `postgresql-client`" is structurally enforced from the
  start, not something to remember to preserve later.

## Consequences

- Phase 5 fills in real cron + `pg_dump` logic inside an already-correct
  topology — no compose rewrite risk.
- The stub costs almost nothing today: one tiny Alpine image, no healthcheck
  dependents, no behavior to test beyond "container starts and stays up."
