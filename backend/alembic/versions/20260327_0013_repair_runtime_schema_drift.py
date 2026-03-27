# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema repair migration that backfills the missing `semesters.review_ready` column on drifted head-stamped SQLite databases]
# pos:    [Backend schema repair revision for local databases that were stamped past a partially applied Semester draft migration]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""repair runtime schema drift

Revision ID: 20260327_0013
Revises: 20260327_0012
Create Date: 2026-03-27 12:13:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260327_0013"
down_revision = "20260327_0012"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "semesters", "review_ready"):
        with op.batch_alter_table("semesters", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("review_ready", sa.Boolean(), nullable=False, server_default=sa.true())
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_column(inspector, "semesters", "review_ready"):
        with op.batch_alter_table("semesters", schema=None) as batch_op:
            batch_op.drop_column("review_ready")
