"""add post hook column

Revision ID: a3f9c1d0e5b2
Revises: 88dcb20a9132
Create Date: 2026-09-01 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3f9c1d0e5b2"
down_revision: str | Sequence[str] | None = "88dcb20a9132"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("posts", sa.Column("hook", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("posts", "hook")
