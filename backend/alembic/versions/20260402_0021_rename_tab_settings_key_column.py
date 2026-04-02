# input:  [Alembic migration context, SQLAlchemy schema inspection helpers, and SQLite batch table rebuild support]
# output: [Schema migration that renames tab_settings.tab_type to settings_key and refreshes the related unique/index metadata]
# pos:    [Backend schema migration for making tab_settings a generic settings-bucket store keyed by settings_key instead of runtime tab_type]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""rename tab_settings key column

Revision ID: 20260402_0021
Revises: 20260402_0020
Create Date: 2026-04-02 15:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260402_0021"
down_revision = "20260402_0020"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {index["name"] for index in inspector.get_indexes(table_name)}


def _unique_constraint_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {
        constraint["name"]
        for constraint in inspector.get_unique_constraints(table_name)
        if constraint.get("name")
    }


def upgrade() -> None:
    column_names = _column_names("tab_settings")
    if "tab_type" not in column_names or "settings_key" in column_names:
        return

    index_names = _index_names("tab_settings")
    op.execute(sa.text("ALTER TABLE tab_settings RENAME COLUMN tab_type TO settings_key"))
    if "ix_tab_settings_tab_type" in index_names:
        op.drop_index("ix_tab_settings_tab_type", table_name="tab_settings")
    if "ix_tab_settings_settings_key" not in index_names:
        op.create_index("ix_tab_settings_settings_key", "tab_settings", ["settings_key"], unique=False)


def downgrade() -> None:
    column_names = _column_names("tab_settings")
    if "settings_key" not in column_names or "tab_type" in column_names:
        return

    index_names = _index_names("tab_settings")
    op.execute(sa.text("ALTER TABLE tab_settings RENAME COLUMN settings_key TO tab_type"))
    if "ix_tab_settings_settings_key" in index_names:
        op.drop_index("ix_tab_settings_settings_key", table_name="tab_settings")
    if "ix_tab_settings_tab_type" not in index_names:
        op.create_index("ix_tab_settings_tab_type", "tab_settings", ["tab_type"], unique=False)
