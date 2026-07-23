# socialtrace

Self-hosted, local-first social media tracking for Community Managers — no
platform API dependency, no scraping. Reconstructs the time curve of a post's
performance and an account's growth from periodic manual captures, which is
the thing no platform's native export gives you.

See `docs/adr/` for the reasoning behind the core architectural decisions
(no scraping, capture windows as queries not stored state, Podman/Compose
Spec).

## Quickstart

```sh
cp .env.example .env
podman compose up --build
```

Then open `http://localhost:8080`.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).
