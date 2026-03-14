# input:  [Alembic migration context and SQLAlchemy schema helpers]
# output: [Schema migration that adds course resource file metadata storage]
# pos:    [Backend schema migration for course-scoped resource file persistence]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add course resource files

Revision ID: 20260314_0004
Revises: 20260313_0003
Create Date: 2026-03-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260314_0004"
down_revision = "20260313_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "course_resource_files",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("course_id", sa.String(), nullable=False),
        sa.Column("filename_original", sa.String(), nullable=False),
        sa.Column("filename_display", sa.String(), nullable=False),
        sa.Column("mime_type", sa.String(), nullable=False, server_default="application/octet-stream"),
        sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_course_resource_files_course_id", "course_resource_files", ["course_id"], unique=False)
    op.create_index("ix_course_resource_files_id", "course_resource_files", ["id"], unique=False)
    op.create_index(
        "ix_course_resource_files_course_updated",
        "course_resource_files",
        ["course_id", "updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_course_resource_files_course_updated", table_name="course_resource_files")
    op.drop_index("ix_course_resource_files_id", table_name="course_resource_files")
    op.drop_index("ix_course_resource_files_course_id", table_name="course_resource_files")
    op.drop_table("course_resource_files")
