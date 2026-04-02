# input:  [Alembic migration context, SQLAlchemy inspector helpers, and semester plugin activation schema state]
# output: [Schema migration that removes the obsolete semester_plugin_activations.setup_state column]
# pos:    [Backend schema migration for deleting the legacy setup_state column after semester plugin setup moved fully into tab_settings]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""drop semester plugin setup_state column

Revision ID: 20260402_0022
Revises: 20260402_0021
Create Date: 2026-04-02 18:30:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260402_0022"
down_revision = "20260402_0021"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if "setup_state" not in _column_names("semester_plugin_activations"):
        return

    with op.batch_alter_table("semester_plugin_activations") as batch_op:
        batch_op.drop_column("setup_state")


def downgrade() -> None:
    if "setup_state" in _column_names("semester_plugin_activations"):
        return

    with op.batch_alter_table("semester_plugin_activations") as batch_op:
        batch_op.add_column(sa.Column("setup_state", sa.Text(), nullable=False, server_default="{}"))
