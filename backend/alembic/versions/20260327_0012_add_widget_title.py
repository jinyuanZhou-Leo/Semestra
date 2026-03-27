# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that restores first-class widget titles]
# pos:    [Backend schema migration for widget title persistence used by widget CRUD responses]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add widget title

Revision ID: 20260327_0012
Revises: 20260326_0011
Create Date: 2026-03-27 00:12:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260327_0012"
down_revision = "20260326_0011"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "widgets", "title"):
        with op.batch_alter_table("widgets", schema=None) as batch_op:
            batch_op.add_column(sa.Column("title", sa.String(), nullable=False, server_default=""))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_column(inspector, "widgets", "title"):
        with op.batch_alter_table("widgets", schema=None) as batch_op:
            batch_op.drop_column("title")
