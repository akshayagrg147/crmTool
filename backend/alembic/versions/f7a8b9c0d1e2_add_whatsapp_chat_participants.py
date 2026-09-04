"""store WhatsApp conversation and participant identity details

Revision ID: f7a8b9c0d1e2
Revises: e5f6a7b8c9d0
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("whatsapp_messages", sa.Column("chat_id", sa.String(length=180), nullable=True))
    op.add_column("whatsapp_messages", sa.Column("chat_type", sa.String(length=12), nullable=False, server_default="direct"))
    op.add_column("whatsapp_messages", sa.Column("chat_name", sa.String(length=255), nullable=True))
    op.add_column("whatsapp_messages", sa.Column("sender_phone", sa.String(length=30), nullable=True))
    op.add_column("whatsapp_messages", sa.Column("sender_name", sa.String(length=255), nullable=True))
    op.add_column("whatsapp_messages", sa.Column("recipient_phone", sa.String(length=30), nullable=True))
    op.add_column("whatsapp_messages", sa.Column("recipient_name", sa.String(length=255), nullable=True))
    op.execute(
        "UPDATE whatsapp_messages SET chat_id = COALESCE(metadata_json->>'remote_jid', contact_phone) "
        "WHERE chat_id IS NULL"
    )
    op.execute(
        "UPDATE whatsapp_messages SET chat_type = 'group' "
        "WHERE COALESCE(metadata_json->>'remote_jid', '') LIKE '%@g.us'"
    )
    op.create_index("ix_whatsapp_messages_chat_id", "whatsapp_messages", ["chat_id"])
    op.create_index("ix_whatsapp_messages_chat_type", "whatsapp_messages", ["chat_type"])


def downgrade() -> None:
    op.drop_index("ix_whatsapp_messages_chat_type", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_chat_id", table_name="whatsapp_messages")
    op.drop_column("whatsapp_messages", "recipient_name")
    op.drop_column("whatsapp_messages", "recipient_phone")
    op.drop_column("whatsapp_messages", "sender_name")
    op.drop_column("whatsapp_messages", "sender_phone")
    op.drop_column("whatsapp_messages", "chat_name")
    op.drop_column("whatsapp_messages", "chat_type")
    op.drop_column("whatsapp_messages", "chat_id")
