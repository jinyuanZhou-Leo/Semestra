# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that upgrades LMS storage to multi-integration Program/Course link architecture]
# pos:    [Backend schema migration for multiple user-owned LMS integrations, Program LMS selection, and Course LMS link metadata with legacy-SQLite compatibility]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""expand lms integrations

Revision ID: 20260314_0007
Revises: 20260314_0006
Create Date: 2026-03-14 00:00:03.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260314_0007"
down_revision = "20260314_0006"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def _has_unique_constraint(inspector: sa.Inspector, table_name: str, constraint_name: str) -> bool:
    return constraint_name in {constraint["name"] for constraint in inspector.get_unique_constraints(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "lms_integrations"):
        has_display_name = _has_column(inspector, "lms_integrations", "display_name")
        has_old_unique = _has_unique_constraint(inspector, "lms_integrations", "uq_lms_integrations_user_provider")
        if not has_display_name or has_old_unique:
            with op.batch_alter_table("lms_integrations", schema=None) as batch_op:
                if not has_display_name:
                    batch_op.add_column(sa.Column("display_name", sa.String(), nullable=False, server_default=""))
                if has_old_unique:
                    batch_op.drop_constraint("uq_lms_integrations_user_provider", type_="unique")
            if not has_display_name:
                op.execute("UPDATE lms_integrations SET display_name = provider WHERE display_name = '' OR display_name IS NULL")
            inspector = sa.inspect(bind)

    if _has_table(inspector, "programs") and not _has_column(inspector, "programs", "lms_integration_id"):
        with op.batch_alter_table("programs", schema=None) as batch_op:
            batch_op.add_column(sa.Column("lms_integration_id", sa.String(), nullable=True))
            batch_op.create_foreign_key(
                "fk_programs_lms_integration_id",
                "lms_integrations",
                ["lms_integration_id"],
                ["id"],
                ondelete="SET NULL",
            )
        inspector = sa.inspect(bind)

    if _has_table(inspector, "programs") and not _has_index(inspector, "programs", "ix_programs_lms_integration_id"):
        op.create_index("ix_programs_lms_integration_id", "programs", ["lms_integration_id"], unique=False)

    if not _has_table(inspector, "course_lms_links"):
        op.create_table(
            "course_lms_links",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("course_id", sa.String(), nullable=False),
            sa.Column("program_id", sa.String(), nullable=False),
            sa.Column("lms_integration_id", sa.String(), nullable=False),
            sa.Column("external_course_id", sa.String(), nullable=False),
            sa.Column("external_course_code", sa.String(), nullable=True),
            sa.Column("external_name", sa.String(), nullable=True),
            sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("last_synced_at", sa.String(), nullable=True),
            sa.Column("last_error_code", sa.String(), nullable=True),
            sa.Column("last_error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False, server_default=""),
            sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["lms_integration_id"], ["lms_integrations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("course_id", name="uq_course_lms_links_course_id"),
            sa.UniqueConstraint(
                "program_id",
                "lms_integration_id",
                "external_course_id",
                name="uq_course_lms_links_program_external_course",
            ),
        )
        inspector = sa.inspect(bind)

    if _has_table(inspector, "course_lms_links") and not _has_index(inspector, "course_lms_links", "ix_course_lms_links_program"):
        op.create_index("ix_course_lms_links_program", "course_lms_links", ["program_id"], unique=False)
    if _has_table(inspector, "course_lms_links") and not _has_index(inspector, "course_lms_links", "ix_course_lms_links_integration"):
        op.create_index("ix_course_lms_links_integration", "course_lms_links", ["lms_integration_id"], unique=False)
    if _has_table(inspector, "course_lms_links") and not _has_index(inspector, "course_lms_links", "ix_course_lms_links_external_course"):
        op.create_index("ix_course_lms_links_external_course", "course_lms_links", ["external_course_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "course_lms_links"):
        if _has_index(inspector, "course_lms_links", "ix_course_lms_links_external_course"):
            op.drop_index("ix_course_lms_links_external_course", table_name="course_lms_links")
        if _has_index(inspector, "course_lms_links", "ix_course_lms_links_integration"):
            op.drop_index("ix_course_lms_links_integration", table_name="course_lms_links")
        if _has_index(inspector, "course_lms_links", "ix_course_lms_links_program"):
            op.drop_index("ix_course_lms_links_program", table_name="course_lms_links")
        op.drop_table("course_lms_links")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "programs") and _has_column(inspector, "programs", "lms_integration_id"):
        if _has_index(inspector, "programs", "ix_programs_lms_integration_id"):
            op.drop_index("ix_programs_lms_integration_id", table_name="programs")
        with op.batch_alter_table("programs", schema=None) as batch_op:
            batch_op.drop_constraint("fk_programs_lms_integration_id", type_="foreignkey")
            batch_op.drop_column("lms_integration_id")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "lms_integrations") and _has_column(inspector, "lms_integrations", "display_name"):
        with op.batch_alter_table("lms_integrations", schema=None) as batch_op:
            if not _has_unique_constraint(inspector, "lms_integrations", "uq_lms_integrations_user_provider"):
                batch_op.create_unique_constraint("uq_lms_integrations_user_provider", ["user_id", "provider"])
            batch_op.drop_column("display_name")
