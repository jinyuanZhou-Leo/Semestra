"""add widget context check

Revision ID: 7b8c1a2d3e4f
Revises: d4de02bc9432
Create Date: 2026-01-29
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "7b8c1a2d3e4f"
down_revision = "d4de02bc9432"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("widgets") as batch_op:
        batch_op.create_check_constraint(
            "ck_widgets_single_context",
            "((semester_id IS NOT NULL AND course_id IS NULL) OR (semester_id IS NULL AND course_id IS NOT NULL))",
        )


def downgrade() -> None:
    with op.batch_alter_table("widgets") as batch_op:
        batch_op.drop_constraint("ck_widgets_single_context", type_="check")
