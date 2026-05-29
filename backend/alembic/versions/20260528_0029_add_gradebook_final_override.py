# input:  [Alembic migration runtime, SQLAlchemy schema inspection helpers, and existing course_gradebooks table]
# output: [Alembic revision that adds nullable final grade percentage overrides to course gradebooks]
# pos:    [Backend schema migration supporting authoritative final course grades that override calculated gradebook percentages]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260528_0029"
down_revision = "20260424_0028"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "course_gradebooks", "final_grade_percentage_override"):
        with op.batch_alter_table("course_gradebooks", schema=None) as batch_op:
            batch_op.add_column(sa.Column("final_grade_percentage_override", sa.Float(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_column(inspector, "course_gradebooks", "final_grade_percentage_override"):
        with op.batch_alter_table("course_gradebooks", schema=None) as batch_op:
            batch_op.drop_column("final_grade_percentage_override")
