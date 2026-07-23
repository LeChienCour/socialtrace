# 2. Podman rootless + Compose Spec

## Status

Accepted

## Context

socialtrace is meant to be self-hosted by a single team, often on a personal
server or workstation, not a managed Kubernetes cluster. The deployment story
needs to be simple, auditable, and not require a root daemon.

## Decision

- Target Podman in rootless mode as the primary container runtime.
- Use the Compose Spec (`compose.yaml`, no `version:` key — that field is
  obsolete in the spec and Podman/Docker Compose both ignore it) so the same
  file works with `podman compose` and `docker compose` interchangeably.
- Provide Quadlet units (`*.container`, `*.volume`) for systemd-user
  autostart in a later phase (6), since `podman-compose` itself lags the
  Compose Spec and Quadlet is the more "native" long-running-service story
  for rootless Podman.

## Consequences

- No root daemon required to run the stack.
- `podman compose up` and `docker compose up` both work against the same
  `compose.yaml` for local dev, lowering the bar for contributors who default
  to Docker.
- Compose service boundaries (one process per container, explicit
  healthchecks, no shared bind-mount choreography between services) are
  chosen up front so the eventual Quadlet translation is mechanical, not a
  redesign.
