# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds optional LMS import provenance columns to gradebook assessments]
# pos:    [Backend schema migration for one-time LMS-to-gradebook assignment imports without sync coupling]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add gradebook lms assignment source

Revision ID: 20260315_0008
Revises: 20260314_0007
Create Date: 2026-03-15 00:00:08.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260315_0008"
down_revision = "20260314_0007"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def _has_unique_constraint(inspector: sa.Inspector, table_name: str, constraint_name: str) -> bool:
    return constraint_name in {constraint["name"] for constraint in inspector.get_unique_constraints(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_name = "gradebook_assessments"
    if not _has_table(inspector, table_name):
        return

    with op.batch_alter_table(table_name, schema=None) as batch_op:
        if not _has_column(inspector, table_name, "source_kind"):
            batch_op.add_column(sa.Column("source_kind", sa.String(), nullable=True))
        if not _has_column(inspector, table_name, "source_external_id"):
            batch_op.add_column(sa.Column("source_external_id", sa.String(), nullable=True))

    inspector = sa.inspect(bind)
    if not _has_index(inspector, table_name, "ix_gradebook_assessments_source_kind"):
        op.create_index("ix_gradebook_assessments_source_kind", table_name, ["source_kind"], unique=False)
    if not _has_index(inspector, table_name, "ix_gradebook_assessments_source_external_id"):
        op.create_index("ix_gradebook_assessments_source_external_id", table_name, ["source_external_id"], unique=False)
    if not _has_unique_constraint(inspector, table_name, "uq_gradebook_assessments_gradebook_source"):
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.create_unique_constraint(
                "uq_gradebook_assessments_gradebook_source",
                ["gradebook_id", "source_kind", "source_external_id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_name = "gradebook_assessments"
    if not _has_table(inspector, table_name):
        return

    if _has_unique_constraint(inspector, table_name, "uq_gradebook_assessments_gradebook_source"):
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.drop_constraint("uq_gradebook_assessments_gradebook_source", type_="unique")

    inspector = sa.inspect(bind)
    if _has_index(inspector, table_name, "ix_gradebook_assessments_source_external_id"):
        op.drop_index("ix_gradebook_assessments_source_external_id", table_name=table_name)
    if _has_index(inspector, table_name, "ix_gradebook_assessments_source_kind"):
        op.drop_index("ix_gradebook_assessments_source_kind", table_name=table_name)

    inspector = sa.inspect(bind)
    with op.batch_alter_table(table_name, schema=None) as batch_op:
        if _has_column(inspector, table_name, "source_external_id"):
            batch_op.drop_column("source_external_id")
        if _has_column(inspector, table_name, "source_kind"):
            batch_op.drop_column("source_kind")
