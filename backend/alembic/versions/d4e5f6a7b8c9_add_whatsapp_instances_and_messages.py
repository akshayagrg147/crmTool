"""add admin-managed whatsapp instances and message tracking

Revision ID: d4e5f6a7b8c9
Revises: c2d3e4f5a6b7
Create Date: 2026-09-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_instances",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("phone_number", sa.String(length=30), nullable=True),
        sa.Column("session_key", sa.String(length=80), nullable=False),
        sa.Column("webhook_secret_hash", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="disconnected"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_key"),
    )
    op.create_index("ix_whatsapp_instances_organization_id", "whatsapp_instances", ["organization_id"])
    op.create_index("ix_whatsapp_instances_assigned_user_id", "whatsapp_instances", ["assigned_user_id"])
    op.create_index("ix_whatsapp_instances_session_key", "whatsapp_instances", ["session_key"])
    op.create_index("ix_whatsapp_instances_status", "whatsapp_instances", ["status"])

    op.create_table(
        "whatsapp_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("external_message_id", sa.String(length=180), nullable=True),
        sa.Column("contact_phone", sa.String(length=30), nullable=False),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("direction", sa.String(length=12), nullable=False),
        sa.Column("message_type", sa.String(length=30), nullable=False, server_default="text"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["instance_id"], ["whatsapp_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("instance_id", "external_message_id", name="uq_whatsapp_message_instance_external"),
    )
    op.create_index("ix_whatsapp_messages_organization_id", "whatsapp_messages", ["organization_id"])
    op.create_index("ix_whatsapp_messages_instance_id", "whatsapp_messages", ["instance_id"])
    op.create_index("ix_whatsapp_messages_lead_id", "whatsapp_messages", ["lead_id"])
    op.create_index("ix_whatsapp_messages_external_message_id", "whatsapp_messages", ["external_message_id"])
    op.create_index("ix_whatsapp_messages_contact_phone", "whatsapp_messages", ["contact_phone"])
    op.create_index("ix_whatsapp_messages_direction", "whatsapp_messages", ["direction"])
    op.create_index("ix_whatsapp_messages_is_read", "whatsapp_messages", ["is_read"])
    op.create_index("ix_whatsapp_messages_sent_at", "whatsapp_messages", ["sent_at"])


def downgrade() -> None:
    op.drop_index("ix_whatsapp_messages_sent_at", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_is_read", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_direction", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_contact_phone", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_external_message_id", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_lead_id", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_instance_id", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_organization_id", table_name="whatsapp_messages")
    op.drop_table("whatsapp_messages")
    op.drop_index("ix_whatsapp_instances_status", table_name="whatsapp_instances")
    op.drop_index("ix_whatsapp_instances_session_key", table_name="whatsapp_instances")
    op.drop_index("ix_whatsapp_instances_assigned_user_id", table_name="whatsapp_instances")
    op.drop_index("ix_whatsapp_instances_organization_id", table_name="whatsapp_instances")
    op.drop_table("whatsapp_instances")
