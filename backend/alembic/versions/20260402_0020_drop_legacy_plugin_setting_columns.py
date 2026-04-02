# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that drops legacy plugin-settings columns now replaced by tab_settings]
# pos:    [Backend schema migration for converging Program and Semester plugin settings onto the tab_settings storage chain]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""drop legacy plugin setting columns

Revision ID: 20260402_0020
Revises: 20260331_0019
Create Date: 2026-04-02 12:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260402_0020"
down_revision = "20260331_0019"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {
        column["name"]
        for column in inspector.get_columns(table_name)
    }


def upgrade() -> None:
    program_installation_columns = _column_names("program_plugin_installations")
    if "program_settings" in program_installation_columns:
        with op.batch_alter_table("program_plugin_installations") as batch_op:
            batch_op.drop_column("program_settings")

    semester_activation_columns = _column_names("semester_plugin_activations")
    if "semester_overrides" in semester_activation_columns:
        with op.batch_alter_table("semester_plugin_activations") as batch_op:
            batch_op.drop_column("semester_overrides")


def downgrade() -> None:
    program_installation_columns = _column_names("program_plugin_installations")
    if "program_settings" not in program_installation_columns:
        with op.batch_alter_table("program_plugin_installations") as batch_op:
            batch_op.add_column(sa.Column("program_settings", sa.Text(), nullable=False, server_default="{}"))

    semester_activation_columns = _column_names("semester_plugin_activations")
    if "semester_overrides" not in semester_activation_columns:
        with op.batch_alter_table("semester_plugin_activations") as batch_op:
            batch_op.add_column(sa.Column("semester_overrides", sa.Text(), nullable=False, server_default="{}"))
