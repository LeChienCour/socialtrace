# 6. Backup sidecar runs as root

## Status

Accepted

## Context

Every other socialtrace container runs as a non-root user (see the
multi-stage Dockerfiles for `backend` and `frontend`). The backup sidecar
(phase 5) needs to write compressed `pg_dump` output to `backup_data`, a
named volume whose host-side ownership under rootless Podman isn't
predictable the way a build-time-created application directory is —
`backend`/`frontend` only ever write inside directories they created during
their own image build, never into a volume mounted from outside.

Fighting that (pre-creating the volume with specific ownership, chowning at
container start, coordinating UID mapping with the host) adds real
complexity for a container that has no network exposure, executes no
user-supplied input, and only ever runs `pg_dump`/`gzip` against a
connection string from its own environment.

## Decision

The `backup` container runs as root (no `USER` directive, default for the
`postgres:16-alpine` base image before its own entrypoint would normally
drop privileges — which we bypass entirely by overriding `ENTRYPOINT`).

## Consequences

- Volume permissions are a non-issue; `mkdir -p` and `pg_dump | gzip > file`
  always succeed regardless of the volume's prior ownership.
- This container has no HTTP server, accepts no external input beyond its
  own environment variables, and its only outputs are files on a volume
  private to it (and read-only-mounted into `backend` for the download
  endpoint) — the blast radius of running as root here is low relative to
  `backend`/`frontend`, which do handle untrusted HTTP input.
- If this ever changes (e.g. the sidecar grows an HTTP interface), revisit.
