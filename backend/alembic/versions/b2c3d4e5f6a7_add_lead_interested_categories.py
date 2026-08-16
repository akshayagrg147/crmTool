"""add multi-category lead preferences

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column(
            "interested_categories",
            sa.ARRAY(sa.String(length=100)),
            server_default=sa.text("'{}'::varchar[]"),
            nullable=True,
        ),
    )
    # Preserve every existing lead's current effective category as its first
    # preference so the new UI never loses the old category value.
    op.execute(
        "UPDATE leads SET interested_categories = ARRAY[COALESCE(custom_category, category::text)] "
        "WHERE interested_categories = '{}'::varchar[] OR interested_categories IS NULL"
    )
    op.alter_column(
        "leads",
        "interested_categories",
        existing_type=sa.ARRAY(sa.String(length=100)),
        nullable=False,
        server_default=sa.text("'{}'::varchar[]"),
    )


def downgrade() -> None:
    op.drop_column("leads", "interested_categories")
