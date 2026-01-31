"""remove_title_from_widgets_and_tabs

Revision ID: f1e2d3c4b5a6
Revises: 7b8c1a2d3e4f
Create Date: 2026-01-31 00:38:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1e2d3c4b5a6'
down_revision = '7b8c1a2d3e4f'
branch_labels = None
depends_on = None


def upgrade():
    # Drop title column from widgets table
    with op.batch_alter_table('widgets', schema=None) as batch_op:
        batch_op.drop_column('title')
    
    # Drop title column from tabs table
    with op.batch_alter_table('tabs', schema=None) as batch_op:
        batch_op.drop_column('title')


def downgrade():
    # Add title column back to tabs table
    with op.batch_alter_table('tabs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('title', sa.String(), nullable=True))
    
    # Add title column back to widgets table
    with op.batch_alter_table('widgets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('title', sa.String(), nullable=True))
