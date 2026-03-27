# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds non-destructive enablement flags for Program plugin installations and Semester plugin activations]
# pos:    [Backend schema migration for CRUD plugin management where disable preserves data and delete removes it]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add plugin enabled flags

Revision ID: 20260327_0014
Revises: 20260327_0013
Create Date: 2026-03-27 14:14:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260327_0014"
down_revision = "20260327_0013"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "program_plugin_installations", "is_enabled"):
        with op.batch_alter_table("program_plugin_installations", schema=None) as batch_op:
            batch_op.add_column(sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))

    inspector = sa.inspect(bind)
    if not _has_column(inspector, "semester_plugin_activations", "is_enabled"):
        with op.batch_alter_table("semester_plugin_activations", schema=None) as batch_op:
            batch_op.add_column(sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_column(inspector, "semester_plugin_activations", "is_enabled"):
        with op.batch_alter_table("semester_plugin_activations", schema=None) as batch_op:
            batch_op.drop_column("is_enabled")

    inspector = sa.inspect(bind)
    if _has_column(inspector, "program_plugin_installations", "is_enabled"):
        with op.batch_alter_table("program_plugin_installations", schema=None) as batch_op:
            batch_op.drop_column("is_enabled")
