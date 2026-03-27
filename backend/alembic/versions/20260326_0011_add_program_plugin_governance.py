# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds Program plugin installations, Semester plugin activations, and Semester draft lifecycle plus review readiness columns]
# pos:    [Backend schema migration for Program-managed plugin governance and Create Semester draft persistence]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add program plugin governance

Revision ID: 20260326_0011
Revises: 20260323_0010
Create Date: 2026-03-26 00:11:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260326_0011"
down_revision = "20260323_0010"
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

    if _has_table(inspector, "semesters"):
        with op.batch_alter_table("semesters", schema=None) as batch_op:
            if not _has_column(inspector, "semesters", "lifecycle_state"):
                batch_op.add_column(sa.Column("lifecycle_state", sa.String(), nullable=False, server_default="active"))
            if not _has_column(inspector, "semesters", "creation_step"):
                batch_op.add_column(sa.Column("creation_step", sa.String(), nullable=False, server_default="review"))
            if not _has_column(inspector, "semesters", "draft_updated_at"):
                batch_op.add_column(sa.Column("draft_updated_at", sa.String(), nullable=True))
            if not _has_column(inspector, "semesters", "review_ready"):
                batch_op.add_column(sa.Column("review_ready", sa.Boolean(), nullable=False, server_default=sa.true()))

    inspector = sa.inspect(bind)
    if _has_table(inspector, "semesters") and not _has_index(inspector, "semesters", "ix_semesters_lifecycle_state"):
        op.create_index("ix_semesters_lifecycle_state", "semesters", ["lifecycle_state"], unique=False)

    inspector = sa.inspect(bind)
    if not _has_table(inspector, "program_plugin_installations"):
        op.create_table(
            "program_plugin_installations",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("program_id", sa.String(), nullable=False),
            sa.Column("plugin_id", sa.String(), nullable=False),
            sa.Column("version", sa.String(), nullable=False, server_default="workspace"),
            sa.Column("auth_state", sa.String(), nullable=False, server_default="not-required"),
            sa.Column("auth_message", sa.Text(), nullable=True),
            sa.Column("program_settings", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.String(), nullable=False, server_default=""),
            sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
            sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("program_id", "plugin_id", name="uq_program_plugin_installations_program_plugin"),
        )
        op.create_index("ix_program_plugin_installations_program", "program_plugin_installations", ["program_id"], unique=False)
        op.create_index("ix_program_plugin_installations_plugin", "program_plugin_installations", ["plugin_id"], unique=False)

    inspector = sa.inspect(bind)
    if not _has_table(inspector, "semester_plugin_activations"):
        op.create_table(
            "semester_plugin_activations",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("semester_id", sa.String(), nullable=False),
            sa.Column("program_plugin_installation_id", sa.String(), nullable=False),
            sa.Column("semester_overrides", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("setup_state", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.String(), nullable=False, server_default=""),
            sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
            sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["program_plugin_installation_id"], ["program_plugin_installations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "semester_id",
                "program_plugin_installation_id",
                name="uq_semester_plugin_activations_semester_installation",
            ),
        )
        op.create_index("ix_semester_plugin_activations_semester", "semester_plugin_activations", ["semester_id"], unique=False)
        op.create_index("ix_semester_plugin_activations_installation", "semester_plugin_activations", ["program_plugin_installation_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "semester_plugin_activations"):
        if _has_index(inspector, "semester_plugin_activations", "ix_semester_plugin_activations_installation"):
            op.drop_index("ix_semester_plugin_activations_installation", table_name="semester_plugin_activations")
        if _has_index(inspector, "semester_plugin_activations", "ix_semester_plugin_activations_semester"):
            op.drop_index("ix_semester_plugin_activations_semester", table_name="semester_plugin_activations")
        op.drop_table("semester_plugin_activations")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "program_plugin_installations"):
        if _has_index(inspector, "program_plugin_installations", "ix_program_plugin_installations_plugin"):
            op.drop_index("ix_program_plugin_installations_plugin", table_name="program_plugin_installations")
        if _has_index(inspector, "program_plugin_installations", "ix_program_plugin_installations_program"):
            op.drop_index("ix_program_plugin_installations_program", table_name="program_plugin_installations")
        op.drop_table("program_plugin_installations")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "semesters") and _has_index(inspector, "semesters", "ix_semesters_lifecycle_state"):
        op.drop_index("ix_semesters_lifecycle_state", table_name="semesters")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "semesters"):
        with op.batch_alter_table("semesters", schema=None) as batch_op:
            if _has_column(inspector, "semesters", "review_ready"):
                batch_op.drop_column("review_ready")
            if _has_column(inspector, "semesters", "draft_updated_at"):
                batch_op.drop_column("draft_updated_at")
            if _has_column(inspector, "semesters", "creation_step"):
                batch_op.drop_column("creation_step")
            if _has_column(inspector, "semesters", "lifecycle_state"):
                batch_op.drop_column("lifecycle_state")
