# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds unassigned-Course plugin activation persistence]
# pos:    [Backend schema migration for per-course plugin enablement on Courses without a Semester]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add program course plugin activations

Revision ID: 20260328_0016
Revises: 20260327_0015
Create Date: 2026-03-28 16:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260328_0016"
down_revision = "20260327_0015"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in set(inspector.get_table_names())


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "program_course_plugin_activations"):
        op.create_table(
            "program_course_plugin_activations",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("course_id", sa.String(), nullable=False),
            sa.Column("program_plugin_installation_id", sa.String(), nullable=False),
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.String(), nullable=False, server_default=""),
            sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["program_plugin_installation_id"],
                ["program_plugin_installations.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "course_id",
                "program_plugin_installation_id",
                name="uq_program_course_plugin_activations_course_installation",
            ),
        )
        op.create_index(
            "ix_program_course_plugin_activations_course",
            "program_course_plugin_activations",
            ["course_id"],
            unique=False,
        )
        op.create_index(
            "ix_program_course_plugin_activations_installation",
            "program_course_plugin_activations",
            ["program_plugin_installation_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "program_course_plugin_activations"):
        if _has_index(
            inspector,
            "program_course_plugin_activations",
            "ix_program_course_plugin_activations_installation",
        ):
            op.drop_index(
                "ix_program_course_plugin_activations_installation",
                table_name="program_course_plugin_activations",
            )
        if _has_index(
            inspector,
            "program_course_plugin_activations",
            "ix_program_course_plugin_activations_course",
        ):
            op.drop_index(
                "ix_program_course_plugin_activations_course",
                table_name="program_course_plugin_activations",
            )
        op.drop_table("program_course_plugin_activations")
