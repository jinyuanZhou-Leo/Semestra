# input:  [Alembic migration runtime, SQLAlchemy schema inspection helpers, and existing todo tables]
# output: [Alembic revision that removes persisted todo order columns and related indexes]
# pos:    [Backend schema migration that aligns todo storage with frontend-local sorting by dropping todo order persistence]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260312_0001"
down_revision = None
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "todo_sections"):
        with op.batch_alter_table("todo_sections") as batch_op:
            if _has_index(inspector, "todo_sections", "ix_todo_sections_semester_order"):
                batch_op.drop_index("ix_todo_sections_semester_order")
            if _has_column(inspector, "todo_sections", "order_index"):
                batch_op.drop_column("order_index")

    if _has_table(inspector, "todo_tasks"):
        with op.batch_alter_table("todo_tasks") as batch_op:
            if _has_index(inspector, "todo_tasks", "ix_todo_tasks_semester_section_order"):
                batch_op.drop_index("ix_todo_tasks_semester_section_order")
            if _has_index(inspector, "todo_tasks", "ix_todo_tasks_semester_order"):
                batch_op.drop_index("ix_todo_tasks_semester_order")
            if _has_column(inspector, "todo_tasks", "order_index"):
                batch_op.drop_column("order_index")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "todo_sections") and not _has_column(inspector, "todo_sections", "order_index"):
        with op.batch_alter_table("todo_sections") as batch_op:
            batch_op.add_column(sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"))
            batch_op.create_index("ix_todo_sections_semester_order", ["semester_id", "order_index"], unique=False)

    if _has_table(inspector, "todo_tasks") and not _has_column(inspector, "todo_tasks", "order_index"):
        with op.batch_alter_table("todo_tasks") as batch_op:
            batch_op.add_column(sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"))
            batch_op.create_index("ix_todo_tasks_semester_order", ["semester_id", "order_index"], unique=False)
            batch_op.create_index("ix_todo_tasks_semester_section_order", ["semester_id", "section_id", "order_index"], unique=False)
