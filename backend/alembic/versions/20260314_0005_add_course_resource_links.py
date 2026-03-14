# input:  [Alembic migration context and SQLAlchemy schema helpers]
# output: [Schema migration that adds link-backed course resource support]
# pos:    [Backend schema migration for URL-only course resource records]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add course resource links

Revision ID: 20260314_0005
Revises: 20260314_0004
Create Date: 2026-03-14 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260314_0005"
down_revision = "20260314_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("course_resource_files") as batch_op:
        batch_op.add_column(sa.Column("resource_kind", sa.String(), nullable=False, server_default="file"))
        batch_op.add_column(sa.Column("external_url", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("course_resource_files") as batch_op:
        batch_op.drop_column("external_url")
        batch_op.drop_column("resource_kind")
