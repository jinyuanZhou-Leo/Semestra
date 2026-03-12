<!-- ⚠️ Once this folder changes, update me. -->

`versions/` stores ordered Alembic revisions for backend schema evolution.
Each file should make one coherent structural change and remain safe to re-run against local SQLite copies where possible.
Keep downgrade steps practical, but prioritize accurate forward migrations for active development databases.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Folder architecture | Local map for backend Alembic revision files. |
| 20260312_0001_drop_todo_order_columns.py | Schema migration | Removes Todo section/task order columns and related indexes now that Todo ordering is local-only in the frontend. |
