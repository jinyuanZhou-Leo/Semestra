# input:  [Alembic migration context and SQLAlchemy schema helpers]
# output: [Schema migration that removes the legacy plugin_settings table]
# pos:    [Backend schema migration that finalizes Plugin System V2 by dropping the obsolete Semester/Course plugin-shared-settings table]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""drop plugin settings table

Revision ID: 20260330_0018
Revises: 20260329_0017
Create Date: 2026-03-30 10:15:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260330_0018"
down_revision = "20260329_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "plugin_settings" in set(inspector.get_table_names()):
        op.drop_table("plugin_settings")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "plugin_settings" in set(inspector.get_table_names()):
        return

    op.create_table(
        "plugin_settings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("plugin_id", sa.String(), nullable=False),
        sa.Column("settings", sa.Text(), nullable=True, server_default=sa.text("'{}'")),
        sa.Column("semester_id", sa.String(), nullable=True),
        sa.Column("course_id", sa.String(), nullable=True),
        sa.CheckConstraint(
            "((semester_id IS NOT NULL AND course_id IS NULL) OR (semester_id IS NULL AND course_id IS NOT NULL))",
            name="ck_plugin_settings_single_context",
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plugin_id", "semester_id", name="uq_plugin_settings_plugin_semester"),
        sa.UniqueConstraint("plugin_id", "course_id", name="uq_plugin_settings_plugin_course"),
    )
    op.create_index("ix_plugin_settings_plugin_id", "plugin_settings", ["plugin_id"], unique=False)
