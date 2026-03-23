# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds user session-version state and persistent auth rate-limit storage]
# pos:    [Backend schema migration for server-enforced logout revocation and database-backed login throttling]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add auth security controls

Revision ID: 20260323_0010
Revises: 20260321_0009
Create Date: 2026-03-23 00:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260323_0010"
down_revision = "20260321_0009"
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

    if _has_table(inspector, "users") and not _has_column(inspector, "users", "session_version"):
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.add_column(sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"))

    inspector = sa.inspect(bind)
    if not _has_table(inspector, "auth_rate_limits"):
        op.create_table(
            "auth_rate_limits",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("scope", sa.String(), nullable=False),
            sa.Column("key_hash", sa.String(), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("window_started_at", sa.String(), nullable=False, server_default=""),
            sa.Column("blocked_until", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False, server_default=""),
            sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("scope", "key_hash", name="uq_auth_rate_limits_scope_key_hash"),
        )
        op.create_index("ix_auth_rate_limits_scope", "auth_rate_limits", ["scope"], unique=False)
        op.create_index("ix_auth_rate_limits_key_hash", "auth_rate_limits", ["key_hash"], unique=False)
        op.create_index(
            "ix_auth_rate_limits_scope_blocked_until",
            "auth_rate_limits",
            ["scope", "blocked_until"],
            unique=False,
        )
    else:
        if not _has_index(inspector, "auth_rate_limits", "ix_auth_rate_limits_scope"):
            op.create_index("ix_auth_rate_limits_scope", "auth_rate_limits", ["scope"], unique=False)
        if not _has_index(inspector, "auth_rate_limits", "ix_auth_rate_limits_key_hash"):
            op.create_index("ix_auth_rate_limits_key_hash", "auth_rate_limits", ["key_hash"], unique=False)
        if not _has_index(inspector, "auth_rate_limits", "ix_auth_rate_limits_scope_blocked_until"):
            op.create_index(
                "ix_auth_rate_limits_scope_blocked_until",
                "auth_rate_limits",
                ["scope", "blocked_until"],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "auth_rate_limits"):
        if _has_index(inspector, "auth_rate_limits", "ix_auth_rate_limits_scope_blocked_until"):
            op.drop_index("ix_auth_rate_limits_scope_blocked_until", table_name="auth_rate_limits")
        if _has_index(inspector, "auth_rate_limits", "ix_auth_rate_limits_key_hash"):
            op.drop_index("ix_auth_rate_limits_key_hash", table_name="auth_rate_limits")
        if _has_index(inspector, "auth_rate_limits", "ix_auth_rate_limits_scope"):
            op.drop_index("ix_auth_rate_limits_scope", table_name="auth_rate_limits")
        op.drop_table("auth_rate_limits")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "users") and _has_column(inspector, "users", "session_version"):
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.drop_column("session_version")
