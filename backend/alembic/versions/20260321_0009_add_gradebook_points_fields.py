# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds optional point-based grading columns to gradebook assessments]
# pos:    [Backend schema migration for storing earned and possible points alongside derived gradebook percentages]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add gradebook points fields

Revision ID: 20260321_0009
Revises: 20260315_0008
Create Date: 2026-03-21 00:00:09.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260321_0009"
down_revision = "20260315_0008"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_name = "gradebook_assessments"
    if not _has_table(inspector, table_name):
        return

    with op.batch_alter_table(table_name, schema=None) as batch_op:
        if not _has_column(inspector, table_name, "points_earned"):
            batch_op.add_column(sa.Column("points_earned", sa.Float(), nullable=True))
        if not _has_column(inspector, table_name, "points_possible"):
            batch_op.add_column(sa.Column("points_possible", sa.Float(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_name = "gradebook_assessments"
    if not _has_table(inspector, table_name):
        return

    with op.batch_alter_table(table_name, schema=None) as batch_op:
        if _has_column(inspector, table_name, "points_possible"):
            batch_op.drop_column("points_possible")
        if _has_column(inspector, table_name, "points_earned"):
            batch_op.drop_column("points_earned")
