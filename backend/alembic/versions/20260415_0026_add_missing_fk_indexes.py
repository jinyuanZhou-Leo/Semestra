# input:  [Alembic migration context]
# output: [DDL migration that adds missing indexes on foreign-key columns in programs, semesters, courses, widgets, and tabs tables]
# pos:    [Performance migration that eliminates full-table-scan lookups on high-frequency FK join columns]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add missing fk indexes

Revision ID: 20260415_0026
Revises: 20260413_0025
Create Date: 2026-04-15 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "20260415_0026"
down_revision = "20260413_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_programs_owner_id", "programs", ["owner_id"])
    op.create_index("ix_semesters_program_id", "semesters", ["program_id"])
    op.create_index("ix_courses_program_id", "courses", ["program_id"])
    op.create_index("ix_courses_semester_id", "courses", ["semester_id"])
    op.create_index("ix_widgets_semester_id", "widgets", ["semester_id"])
    op.create_index("ix_widgets_course_id", "widgets", ["course_id"])
    op.create_index("ix_tabs_semester_id", "tabs", ["semester_id"])
    op.create_index("ix_tabs_course_id", "tabs", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_tabs_course_id", table_name="tabs")
    op.drop_index("ix_tabs_semester_id", table_name="tabs")
    op.drop_index("ix_widgets_course_id", table_name="widgets")
    op.drop_index("ix_widgets_semester_id", table_name="widgets")
    op.drop_index("ix_courses_semester_id", table_name="courses")
    op.drop_index("ix_courses_program_id", table_name="courses")
    op.drop_index("ix_semesters_program_id", table_name="semesters")
    op.drop_index("ix_programs_owner_id", table_name="programs")
