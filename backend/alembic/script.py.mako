## input:  [Alembic revision identifiers and generated upgrade/downgrade operations]
## output: [Revision-file template used by Alembic when creating backend migrations]
## pos:    [Template source for standardized backend Alembic revision scripts]
##
## ⚠️ When this file is updated:
##    1. Update these header comments
##    2. Update the INDEX.md of the folder this file belongs to
"""${message}"""

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
