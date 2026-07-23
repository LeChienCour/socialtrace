from alembic.config import Config

from alembic import command


def test_upgrade_head_from_empty(alembic_config: Config) -> None:
    """Phase 0 ships zero revisions — this proves the tooling itself works
    (connects, reads config, applies the "no-op" head) ahead of any real
    tables existing."""
    command.upgrade(alembic_config, "head")


def test_downgrade_and_reupgrade_is_idempotent(alembic_config: Config) -> None:
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")
