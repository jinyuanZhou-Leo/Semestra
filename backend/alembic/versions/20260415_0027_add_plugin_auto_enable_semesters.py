# input:  [Alembic migration context]
# output: [DDL migration that adds plugin_auto_enable_semesters to programs and pending_activation_review to semester_plugin_activations]
# pos:    [Schema migration supporting the new Program-level setting that controls whether newly installed plugins are automatically propagated to existing Semesters]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add plugin auto enable semesters setting

Revision ID: 20260415_0027
Revises: 20260415_0026
Create Date: 2026-04-15 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260415_0027"
down_revision = "20260415_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("programs", sa.Column("plugin_auto_enable_semesters", sa.String(), nullable=False, server_default="ask"))
    op.add_column("semester_plugin_activations", sa.Column("pending_activation_review", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("semester_plugin_activations", "pending_activation_review")
    op.drop_column("programs", "plugin_auto_enable_semesters")
