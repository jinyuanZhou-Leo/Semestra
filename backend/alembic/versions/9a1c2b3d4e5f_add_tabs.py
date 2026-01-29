"""add tabs

Revision ID: 9a1c2b3d4e5f
Revises: 7b8c1a2d3e4f
Create Date: 2026-01-29
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9a1c2b3d4e5f"
down_revision = "7b8c1a2d3e4f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tabs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tab_type", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("settings", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=True),
        sa.Column("is_removable", sa.Boolean(), nullable=True),
        sa.Column("semester_id", sa.String(), nullable=True),
        sa.Column("course_id", sa.String(), nullable=True),
        sa.CheckConstraint(
            "((semester_id IS NOT NULL AND course_id IS NULL) OR (semester_id IS NULL AND course_id IS NOT NULL))",
            name="ck_tabs_single_context",
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tabs_id"), "tabs", ["id"], unique=False)
    op.create_index(op.f("ix_tabs_tab_type"), "tabs", ["tab_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tabs_tab_type"), table_name="tabs")
    op.drop_index(op.f("ix_tabs_id"), table_name="tabs")
    op.drop_table("tabs")
