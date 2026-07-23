"""Session-wide Postgres testcontainer setup.

Env vars must be set in `pytest_configure` (before collection) rather than in
a regular fixture, because `socialtrace.settings.settings` is a module-level
singleton constructed at import time — by the time any fixture runs, test
modules have already imported `socialtrace.*` and read the default env vars.
"""

import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest
from alembic.config import Config
from testcontainers.postgres import PostgresContainer

from alembic import command

if TYPE_CHECKING:
    from fastapi import FastAPI

_container: PostgresContainer | None = None

TEST_API_TOKEN = "test-token"
AUTH_HEADERS = {"Authorization": f"Bearer {TEST_API_TOKEN}"}


def pytest_configure(config: Any) -> None:
    global _container
    _container = PostgresContainer("postgres:16-alpine")
    _container.start()
    os.environ["SOCIALTRACE_POSTGRES_HOST"] = _container.get_container_host_ip()
    os.environ["SOCIALTRACE_POSTGRES_PORT"] = str(_container.get_exposed_port(5432))
    os.environ["SOCIALTRACE_POSTGRES_DB"] = _container.dbname
    os.environ["SOCIALTRACE_POSTGRES_USER"] = _container.username
    os.environ["SOCIALTRACE_POSTGRES_PASSWORD"] = _container.password
    os.environ["SOCIALTRACE_API_TOKEN"] = TEST_API_TOKEN


def pytest_unconfigure(config: Any) -> None:
    if _container is not None:
        _container.stop()


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    return Config(str(Path(__file__).parent.parent / "alembic.ini"))


@pytest.fixture(scope="session", autouse=True)
def _migrated_db(alembic_config: Config) -> None:
    command.upgrade(alembic_config, "head")


def make_test_app() -> "FastAPI":
    """`ASGITransport` doesn't run the app's lifespan (where the API token is
    normally set on `app.state`), so tests set it directly instead."""
    from socialtrace.main import create_app

    app = create_app()
    app.state.api_token = TEST_API_TOKEN
    return app


@pytest.fixture(autouse=True)
async def _clean_tables() -> AsyncIterator[None]:
    """Truncate between tests so accounts/posts fixtures never collide on
    the platform+handle UNIQUE constraint across test functions."""
    yield
    from sqlalchemy import text

    from socialtrace.db.session import engine

    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE posts, accounts RESTART IDENTITY CASCADE"))
