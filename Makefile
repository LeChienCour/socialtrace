# Container engine used for all targets below. Override for Docker:
#   make up COMPOSE="docker compose"
COMPOSE ?= podman compose

.PHONY: help
help:
	@echo "socialtrace — common tasks"
	@echo ""
	@echo "  make up          Build and start the full stack (http://localhost:8080)"
	@echo "  make down        Stop the stack"
	@echo "  make logs        Follow logs for all services"
	@echo "  make ps          Show service status/health"
	@echo "  make migrate     Run Alembic migrations against the running db"
	@echo "  make test        Run backend test suite (real Postgres via testcontainers)"
	@echo "  make lint        Run backend + frontend lint/type checks"
	@echo "  make seed        Seed ~6 months of realistic demo data (stack must be running)"
	@echo "  make clean       Stop the stack and delete its volumes (destroys DB data)"
	@echo ""
	@echo "Override the engine with COMPOSE, e.g.: make up COMPOSE=\"docker compose\""

.env:
	cp .env.example .env
	@echo "Created .env from .env.example — edit it before running in anything but local dev."

.PHONY: up
up: .env
	$(COMPOSE) up --build -d

.PHONY: down
down:
	$(COMPOSE) down

.PHONY: logs
logs:
	$(COMPOSE) logs -f

.PHONY: ps
ps:
	$(COMPOSE) ps

.PHONY: migrate
migrate:
	$(COMPOSE) exec backend alembic upgrade head

.PHONY: test
test:
	cd backend && uv run pytest -v

.PHONY: lint
lint:
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy --strict src
	cd frontend && pnpm lint

.PHONY: seed
seed: .env
	set -a && . ./.env && set +a && cd backend && uv sync -q && uv run python scripts/seed_demo.py

.PHONY: clean
clean:
	$(COMPOSE) down -v
