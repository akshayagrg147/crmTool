"""add lead assignment history

Revision ID: a1b2c3d4e5f6
Revises: 9a7b8c6d5e4f
Create Date: 2026-08-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "9a7b8c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lead_assignment_history",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("lead_id", sa.UUID(), nullable=False),
        sa.Column("previous_assignee_id", sa.UUID(), nullable=True),
        sa.Column("new_assignee_id", sa.UUID(), nullable=True),
        sa.Column("assigned_by_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["previous_assignee_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["new_assignee_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lead_assignment_history_organization_id", "lead_assignment_history", ["organization_id"])
    op.create_index("ix_lead_assignment_history_lead_id", "lead_assignment_history", ["lead_id"])


def downgrade() -> None:
    op.drop_index("ix_lead_assignment_history_lead_id", table_name="lead_assignment_history")
    op.drop_index("ix_lead_assignment_history_organization_id", table_name="lead_assignment_history")
    op.drop_table("lead_assignment_history")
