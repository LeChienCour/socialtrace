"""Session-wide Postgres testcontainer setup.

Env vars must be set in `pytest_configure` (before collection) rather than in
a regular fixture, because `socialtrace.settings.settings` is a module-level
singleton constructed at import time — by the time any fixture runs, test
modules have already imported `socialtrace.*` and read the default env vars.
"""

import os
from pathlib import Path
from typing import Any

import pytest
from alembic.config import Config
from testcontainers.postgres import PostgresContainer

from alembic import command

_container: PostgresContainer | None = None


def pytest_configure(config: Any) -> None:
    global _container
    _container = PostgresContainer("postgres:16-alpine")
    _container.start()
    os.environ["SOCIALTRACE_POSTGRES_HOST"] = _container.get_container_host_ip()
    os.environ["SOCIALTRACE_POSTGRES_PORT"] = str(_container.get_exposed_port(5432))
    os.environ["SOCIALTRACE_POSTGRES_DB"] = _container.dbname
    os.environ["SOCIALTRACE_POSTGRES_USER"] = _container.username
    os.environ["SOCIALTRACE_POSTGRES_PASSWORD"] = _container.password


def pytest_unconfigure(config: Any) -> None:
    if _container is not None:
        _container.stop()


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    return Config(str(Path(__file__).parent.parent / "alembic.ini"))


@pytest.fixture(scope="session", autouse=True)
def _migrated_db(alembic_config: Config) -> None:
    command.upgrade(alembic_config, "head")
