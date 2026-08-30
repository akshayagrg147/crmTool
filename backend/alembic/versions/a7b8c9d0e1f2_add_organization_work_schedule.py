"""add organization work schedules and payroll date overrides

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-08-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organization_work_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("working_days", sa.JSON(), nullable=False),
        sa.Column("standard_hours_per_day", sa.Numeric(precision=4, scale=2), nullable=False, server_default="8"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", name="uq_organization_work_schedule_org"),
    )
    op.create_index(
        "ix_organization_work_schedules_organization_id",
        "organization_work_schedules",
        ["organization_id"],
    )

    op.create_table(
        "organization_schedule_exceptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exception_date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_working_day", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "exception_date", name="uq_schedule_exception_org_date"),
    )
    op.create_index(
        "ix_organization_schedule_exceptions_organization_id",
        "organization_schedule_exceptions",
        ["organization_id"],
    )
    op.create_index(
        "ix_organization_schedule_exceptions_exception_date",
        "organization_schedule_exceptions",
        ["exception_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_organization_schedule_exceptions_exception_date",
        table_name="organization_schedule_exceptions",
    )
    op.drop_index(
        "ix_organization_schedule_exceptions_organization_id",
        table_name="organization_schedule_exceptions",
    )
    op.drop_table("organization_schedule_exceptions")
    op.drop_index(
        "ix_organization_work_schedules_organization_id",
        table_name="organization_work_schedules",
    )
    op.drop_table("organization_work_schedules")
