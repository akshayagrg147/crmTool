"""add organization lead categories

Revision ID: 9a7b8c6d5e4f
Revises: 8f3c21d0b74e
Create Date: 2026-08-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9a7b8c6d5e4f"
down_revision: Union[str, None] = "8f3c21d0b74e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lead_categories",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lead_categories_organization_id", "lead_categories", ["organization_id"], unique=False)
    op.execute(
        "CREATE UNIQUE INDEX uq_lead_categories_org_name_ci "
        "ON lead_categories (organization_id, lower(name))"
    )
    op.add_column("leads", sa.Column("custom_category", sa.String(length=100), nullable=True))
    op.create_index("ix_leads_custom_category", "leads", ["custom_category"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_leads_custom_category", table_name="leads")
    op.drop_column("leads", "custom_category")
    op.execute("DROP INDEX IF EXISTS uq_lead_categories_org_name_ci")
    op.drop_index("ix_lead_categories_organization_id", table_name="lead_categories")
    op.drop_table("lead_categories")
