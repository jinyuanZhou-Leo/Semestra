<!-- ⚠️ Once this folder changes, update me. -->

`alembic/` contains the backend's versioned schema migration environment.
It wires Alembic to the Semestra SQLAlchemy metadata and keeps individual revisions under `versions/`.
Runtime code no longer owns ad-hoc schema rewrite steps; structural changes such as course resources and LMS integration storage should land here first.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Folder architecture | Local map for the backend Alembic environment. |
| env.py | Alembic runtime | Connects Alembic to backend metadata and configured database URL for online/offline runs. |
| script.py.mako | Revision template | Template used when generating new Alembic revision files. |
| versions/ | Revision history | Versioned migration scripts for backend schema changes. |
