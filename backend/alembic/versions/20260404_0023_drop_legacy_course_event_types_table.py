# input:  [Alembic migration context and SQLAlchemy inspector helpers]
# output: [Schema migration that removes the legacy course_event_types table and old event-type foreign keys after builtin-event-core moved fully into tab settings]
# pos:    [Backend schema migration for deleting legacy course event type table dependencies]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""drop legacy course event types table

Revision ID: 20260404_0023
Revises: 20260402_0022
Create Date: 2026-04-04 15:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260404_0023"
down_revision = "20260402_0022"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in set(inspector.get_table_names())


def _constraint_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {item["name"] for item in inspector.get_foreign_keys(table_name) if item.get("name")}


def _drop_foreign_key_if_present(table_name: str, constraint_name: str) -> None:
    if constraint_name not in _constraint_names(table_name):
        return
    with op.batch_alter_table(table_name) as batch_op:
        batch_op.drop_constraint(constraint_name, type_="foreignkey")


def upgrade() -> None:
    if _has_table("course_sections"):
        _drop_foreign_key_if_present("course_sections", "fk_course_sections_event_type")
    if _has_table("course_events"):
        _drop_foreign_key_if_present("course_events", "fk_course_events_event_type")
    if _has_table("course_event_types"):
        op.drop_table("course_event_types")


def downgrade() -> None:
    if not _has_table("course_event_types"):
        op.create_table(
            "course_event_types",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("course_id", sa.String(), nullable=False),
            sa.Column("code", sa.String(), nullable=False),
            sa.Column("abbreviation", sa.String(), nullable=False),
            sa.Column("track_attendance", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("color", sa.String(), nullable=True),
            sa.Column("icon", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False, server_default=""),
            sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("course_id", "abbreviation", name="uq_course_event_types_course_abbreviation"),
            sa.UniqueConstraint("course_id", "code", name="uq_course_event_types_course_code"),
        )
        op.create_index("ix_course_event_types_course_code", "course_event_types", ["course_id", "code"])
        op.create_index(op.f("ix_course_event_types_id"), "course_event_types", ["id"], unique=False)
        op.create_index(op.f("ix_course_event_types_course_id"), "course_event_types", ["course_id"], unique=False)

    if _has_table("course_sections") and "fk_course_sections_event_type" not in _constraint_names("course_sections"):
        with op.batch_alter_table("course_sections") as batch_op:
            batch_op.create_foreign_key(
                "fk_course_sections_event_type",
                "course_event_types",
                ["course_id", "event_type_code"],
                ["course_id", "code"],
                ondelete="CASCADE",
            )

    if _has_table("course_events") and "fk_course_events_event_type" not in _constraint_names("course_events"):
        with op.batch_alter_table("course_events") as batch_op:
            batch_op.create_foreign_key(
                "fk_course_events_event_type",
                "course_event_types",
                ["course_id", "event_type_code"],
                ["course_id", "code"],
                ondelete="CASCADE",
            )
