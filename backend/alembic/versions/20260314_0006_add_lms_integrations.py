# input:  [Alembic migration context and SQLAlchemy schema helpers]
# output: [Schema migration that adds provider-neutral LMS integration storage]
# pos:    [Backend schema migration for encrypted user-owned LMS connection records]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add lms integrations

Revision ID: 20260314_0006
Revises: 20260314_0005
Create Date: 2026-03-14 00:00:02.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260314_0006"
down_revision = "20260314_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lms_integrations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="connected"),
        sa.Column("config_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("credentials_encrypted", sa.Text(), nullable=False, server_default=""),
        sa.Column("last_checked_at", sa.String(), nullable=True),
        sa.Column("last_error_code", sa.String(), nullable=True),
        sa.Column("last_error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.String(), nullable=False, server_default=""),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "provider", name="uq_lms_integrations_user_provider"),
    )
    op.create_index("ix_lms_integrations_id", "lms_integrations", ["id"], unique=False)
    op.create_index("ix_lms_integrations_user_id", "lms_integrations", ["user_id"], unique=False)
    op.create_index("ix_lms_integrations_user_provider", "lms_integrations", ["user_id", "provider"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_lms_integrations_user_provider", table_name="lms_integrations")
    op.drop_index("ix_lms_integrations_user_id", table_name="lms_integrations")
    op.drop_index("ix_lms_integrations_id", table_name="lms_integrations")
    op.drop_table("lms_integrations")
