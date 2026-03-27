# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds a partial unique index enforcing one draft Semester per Program]
# pos:    [Backend schema migration for the Semester draft wizard's single-draft invariant]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add single draft index

Revision ID: 20260327_0015
Revises: 20260327_0014
Create Date: 2026-03-27 16:05:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260327_0015"
down_revision = "20260327_0014"
branch_labels = None
depends_on = None


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_index(inspector, "semesters", "uq_semesters_program_single_draft"):
        op.create_index(
            "uq_semesters_program_single_draft",
            "semesters",
            ["program_id"],
            unique=True,
            sqlite_where=sa.text("lifecycle_state = 'draft'"),
            postgresql_where=sa.text("lifecycle_state = 'draft'"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_index(inspector, "semesters", "uq_semesters_program_single_draft"):
        op.drop_index("uq_semesters_program_single_draft", table_name="semesters")
