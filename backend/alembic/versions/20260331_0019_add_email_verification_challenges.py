# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds verified-email state and email-verification challenge storage]
# pos:    [Backend schema migration for Resend-backed auth email-code verification flows]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add email verification challenges

Revision ID: 20260331_0019
Revises: 20260330_0018
Create Date: 2026-03-31 12:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260331_0019"
down_revision = "20260330_0018"
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

    if _has_table(inspector, "users") and not _has_column(inspector, "users", "email_verified_at"):
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.add_column(sa.Column("email_verified_at", sa.String(), nullable=True))

    inspector = sa.inspect(bind)
    if not _has_table(inspector, "email_verification_challenges"):
        op.create_table(
            "email_verification_challenges",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("purpose", sa.String(), nullable=False),
            sa.Column("code_hash", sa.String(), nullable=False, server_default=""),
            sa.Column("verification_nonce", sa.String(), nullable=True),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("expires_at", sa.String(), nullable=False, server_default=""),
            sa.Column("last_sent_at", sa.String(), nullable=True),
            sa.Column("verified_at", sa.String(), nullable=True),
            sa.Column("used_at", sa.String(), nullable=True),
            sa.Column("invalidated_at", sa.String(), nullable=True),
            sa.Column("resend_email_id", sa.String(), nullable=True),
            sa.Column("request_ip", sa.String(), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False, server_default=""),
            sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_email_verification_challenges_email_purpose",
            "email_verification_challenges",
            ["email", "purpose"],
            unique=False,
        )
        op.create_index(
            "ix_email_verification_challenges_expires_at",
            "email_verification_challenges",
            ["expires_at"],
            unique=False,
        )
        op.create_index(
            "ix_email_verification_challenges_email",
            "email_verification_challenges",
            ["email"],
            unique=False,
        )
        op.create_index(
            "ix_email_verification_challenges_purpose",
            "email_verification_challenges",
            ["purpose"],
            unique=False,
        )
        op.create_index(
            "ix_email_verification_challenges_id",
            "email_verification_challenges",
            ["id"],
            unique=False,
        )
    else:
        if not _has_index(inspector, "email_verification_challenges", "ix_email_verification_challenges_email_purpose"):
            op.create_index(
                "ix_email_verification_challenges_email_purpose",
                "email_verification_challenges",
                ["email", "purpose"],
                unique=False,
            )
        if not _has_index(inspector, "email_verification_challenges", "ix_email_verification_challenges_expires_at"):
            op.create_index(
                "ix_email_verification_challenges_expires_at",
                "email_verification_challenges",
                ["expires_at"],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "email_verification_challenges"):
        for index_name in [
            "ix_email_verification_challenges_expires_at",
            "ix_email_verification_challenges_email_purpose",
            "ix_email_verification_challenges_purpose",
            "ix_email_verification_challenges_email",
            "ix_email_verification_challenges_id",
        ]:
            if _has_index(inspector, "email_verification_challenges", index_name):
                op.drop_index(index_name, table_name="email_verification_challenges")
        op.drop_table("email_verification_challenges")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "users") and _has_column(inspector, "users", "email_verified_at"):
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.drop_column("email_verified_at")
