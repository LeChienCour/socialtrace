# socialtrace

Self-hosted, local-first social media tracking for Community Managers — no
platform API dependency, no scraping. Reconstructs the time curve of a post's
performance and an account's growth from periodic manual captures, which is
the thing no platform's native export gives you.

## Status

Early — phase 0 of a 7-phase roadmap (scaffolding stage). Right now this is a
developer-facing skeleton: no account/post management screens yet, no demo
data, no setup wizard. Running it today requires the tools listed below and
some comfort with a terminal. It is **not yet** something a non-technical
Community Manager can install and use unassisted — that's the goal, not the
current state.

See `docs/adr/` for the reasoning behind the core architectural decisions
(no scraping, capture windows as queries not stored state, Podman/Compose
Spec).

## Requirements

You need two tools installed: **Git** (to get the code) and a **container
engine** (to run it) — either Docker or Podman.

- **Docker** is the common choice if you just want to run the app. Runs a
  background service (the Docker daemon).
- **Podman** is a daemonless, rootless alternative — what this project's own
  maintainers use day to day. Nothing in `compose.yaml` is Docker- or
  Podman-specific; either works.

Pick one container engine — you don't need both.

### 1. Install Git

- **Windows**: install [Git for Windows](https://git-scm.com/download/win),
  which also gives you Git Bash for running the shell commands below. Or use
  `winget install --id Git.Git -e`.
- **macOS**: `xcode-select --install`, or `brew install git` if you use
  [Homebrew](https://brew.sh).
- **Linux**: `sudo apt install git` (Debian/Ubuntu), `sudo dnf install git`
  (Fedora), `sudo pacman -S git` (Arch).

### 2. Install a container engine

**Docker** (recommended if you're not sure which to pick):

- **Windows / macOS**: install [Docker Desktop](https://www.docker.com/products/docker-desktop/),
  open it once so the background service starts, then confirm in a terminal:
  `docker --version`.
- **Linux**: follow the [official install steps](https://docs.docker.com/engine/install/)
  for your distribution, then log out/in so your user can run Docker without
  `sudo` (`sudo usermod -aG docker $USER`).

**Podman** (daemonless, rootless):

- **macOS**: `brew install podman`, then `podman machine init && podman
  machine start` (Podman needs a small Linux VM on macOS — this is that VM).
- **Windows**: `winget install -e --id RedHat.Podman`, then `podman machine
  init && podman machine start` in a terminal (same VM requirement as macOS).
- **Linux**: Podman runs natively, no VM needed —
  `sudo apt install podman` (Debian/Ubuntu 13+), `sudo dnf install podman`
  (Fedora), or see the [official install matrix](https://podman.io/docs/installation)
  for your distribution.

Either way, confirm the compose plugin is present: `docker compose version`
or `podman compose version`.

### 3. Optional: `make`

The commands below work either through `make` or by calling
`docker compose`/`podman compose` directly — `make` just saves typing.
It's preinstalled on macOS and most Linux distributions. On Windows, either
use Git Bash with `make` from Git for Windows' optional components, WSL, or
skip `make` and run the underlying compose commands shown next to each
target in the [Makefile](Makefile).

## Quickstart

```sh
git clone https://github.com/LeChienCour/socialtrace.git
cd socialtrace
make up
```

`make up` copies `.env.example` to `.env` on first run (edit it first if you
want non-default credentials), then builds and starts everything. Using
Docker instead of Podman: `make up COMPOSE="docker compose"`.

Once it's up, open `http://localhost:8080`.

Other useful commands (see `make help` for the full list):

```sh
make logs      # follow logs for all services
make ps        # check service health
make down      # stop everything
make clean     # stop everything and delete the database volume
```

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for running the backend/frontend
outside containers, tests, and linting.
