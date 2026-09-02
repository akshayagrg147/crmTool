"""add organization attendance locations and geofenced check-in records

Revision ID: c2d3e4f5a6b7
Revises: b8c9d0e1f2a3
Create Date: 2026-09-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("attendance_location_name", sa.String(length=255), nullable=True))
    op.add_column("organizations", sa.Column("attendance_latitude", sa.Numeric(precision=9, scale=6), nullable=True))
    op.add_column("organizations", sa.Column("attendance_longitude", sa.Numeric(precision=9, scale=6), nullable=True))
    op.add_column(
        "organizations",
        sa.Column("attendance_radius_meters", sa.Integer(), nullable=False, server_default="200"),
    )

    op.create_table(
        "attendance_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("check_in_latitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("check_in_longitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("check_in_accuracy_meters", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("check_out_latitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("check_out_longitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("check_out_accuracy_meters", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            "attendance_date",
            name="uq_attendance_record_org_user_date",
        ),
    )
    op.create_index("ix_attendance_records_organization_id", "attendance_records", ["organization_id"])
    op.create_index("ix_attendance_records_user_id", "attendance_records", ["user_id"])
    op.create_index("ix_attendance_records_attendance_date", "attendance_records", ["attendance_date"])

    op.add_column(
        "time_entries",
        sa.Column("attendance_record_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_time_entries_attendance_record_id",
        "time_entries",
        "attendance_records",
        ["attendance_record_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_time_entries_attendance_record_id", "time_entries", ["attendance_record_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_time_entries_attendance_record_id", table_name="time_entries")
    op.drop_constraint("fk_time_entries_attendance_record_id", "time_entries", type_="foreignkey")
    op.drop_column("time_entries", "attendance_record_id")
    op.drop_index("ix_attendance_records_attendance_date", table_name="attendance_records")
    op.drop_index("ix_attendance_records_user_id", table_name="attendance_records")
    op.drop_index("ix_attendance_records_organization_id", table_name="attendance_records")
    op.drop_table("attendance_records")
    op.drop_column("organizations", "attendance_radius_meters")
    op.drop_column("organizations", "attendance_longitude")
    op.drop_column("organizations", "attendance_latitude")
    op.drop_column("organizations", "attendance_location_name")
