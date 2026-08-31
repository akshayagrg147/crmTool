"""add organization branding storage metadata

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("logo_url", sa.String(length=1024), nullable=True))
    op.add_column("organizations", sa.Column("logo_storage_key", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "logo_storage_key")
    op.drop_column("organizations", "logo_url")
