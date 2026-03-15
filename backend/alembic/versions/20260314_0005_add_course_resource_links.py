# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds link-backed course resource support]
# pos:    [Backend schema migration for URL-only course resource records with legacy-SQLite compatibility]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add course resource links

Revision ID: 20260314_0005
Revises: 20260314_0004
Create Date: 2026-03-14 00:00:01.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260314_0005"
down_revision = "20260314_0004"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "course_resource_files"):
        return

    has_resource_kind = _has_column(inspector, "course_resource_files", "resource_kind")
    has_external_url = _has_column(inspector, "course_resource_files", "external_url")
    if has_resource_kind and has_external_url:
        return

    with op.batch_alter_table("course_resource_files") as batch_op:
        if not has_resource_kind:
            batch_op.add_column(sa.Column("resource_kind", sa.String(), nullable=False, server_default="file"))
        if not has_external_url:
            batch_op.add_column(sa.Column("external_url", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "course_resource_files"):
        return

    has_resource_kind = _has_column(inspector, "course_resource_files", "resource_kind")
    has_external_url = _has_column(inspector, "course_resource_files", "external_url")
    if not has_resource_kind and not has_external_url:
        return

    with op.batch_alter_table("course_resource_files") as batch_op:
        if has_external_url:
            batch_op.drop_column("external_url")
        if has_resource_kind:
            batch_op.drop_column("resource_kind")
