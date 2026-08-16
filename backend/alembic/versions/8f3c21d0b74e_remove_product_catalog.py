"""remove product catalog

Drops the products table and the product_id references on leads and call_logs.
Order matters: the columns carry FK constraints pointing at products, so they
must go before the table itself, otherwise Postgres refuses the drop with
DependentObjectsStillExistError.

order_value on call_logs is deliberately kept — it records the value of the
order, which is still meaningful without a product attached to it.

Revision ID: 8f3c21d0b74e
Revises: 616aac040307
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa

revision = "8f3c21d0b74e"
down_revision = "616aac040307"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Dropping a column drops the FK constraint that hangs off it.
    op.drop_column("leads", "product_id")
    op.drop_column("call_logs", "product_id")
    op.drop_index(op.f("ix_products_organization_id"), table_name="products")
    op.drop_table("products")


def downgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_products_organization_id"), "products", ["organization_id"], unique=False)
    op.add_column("call_logs", sa.Column("product_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "call_logs_product_id_fkey", "call_logs", "products", ["product_id"], ["id"], ondelete="SET NULL"
    )
    op.add_column("leads", sa.Column("product_id", sa.UUID(), nullable=True))
    op.create_foreign_key("leads_product_id_fkey", "leads", "products", ["product_id"], ["id"], ondelete="SET NULL")
