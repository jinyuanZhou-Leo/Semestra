# input:  [Alembic migration runtime, SQLAlchemy schema inspection helpers, and existing courses table]
# output: [Alembic revision that drops the legacy per-course hide_gpa column]
# pos:    [Backend schema migration removing the Course-only GPA visibility flag while preserving Program.hide_gpa]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260424_0028"
down_revision = "20260415_0027"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_column(inspector, "courses", "hide_gpa"):
        with op.batch_alter_table("courses", schema=None) as batch_op:
            batch_op.drop_column("hide_gpa")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "courses", "hide_gpa"):
        with op.batch_alter_table("courses", schema=None) as batch_op:
            batch_op.add_column(sa.Column("hide_gpa", sa.Boolean(), nullable=False, server_default=sa.false()))
