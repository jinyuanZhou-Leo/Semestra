# input:  [Alembic migration runtime, SQLAlchemy schema inspection helpers, and existing courses table]
# output: [Alembic revision that adds the legacy per-course color override column]
# pos:    [Backend schema migration that backfills the missing `courses.color` column on older SQLite databases]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260313_0003"
down_revision = "20260312_0002"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "courses") and not _has_column(inspector, "courses", "color"):
        with op.batch_alter_table("courses") as batch_op:
            batch_op.add_column(sa.Column("color", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "courses") and _has_column(inspector, "courses", "color"):
        with op.batch_alter_table("courses") as batch_op:
            batch_op.drop_column("color")
