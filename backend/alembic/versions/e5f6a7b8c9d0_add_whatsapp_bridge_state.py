"""Store encrypted bridge token and the current WhatsApp Web QR code.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("whatsapp_instances", sa.Column("webhook_secret_encrypted", sa.Text(), nullable=True))
    op.add_column("whatsapp_instances", sa.Column("qr_code", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("whatsapp_instances", "qr_code")
    op.drop_column("whatsapp_instances", "webhook_secret_encrypted")
