<!-- ⚠️ Once this folder changes, update me. -->

`versions/` stores ordered Alembic revisions for backend schema evolution.
Each file should make one coherent structural change and remain safe to re-run against local SQLite copies where possible.
Keep downgrade steps practical, but prioritize accurate forward migrations for active development databases.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Folder architecture | Local map for backend Alembic revision files. |
| 20260312_0001_drop_todo_order_columns.py | Schema migration | Removes Todo section/task order columns and related indexes now that Todo ordering is local-only in the frontend. |
| 20260312_0002_add_program_subject_color_map.py | Schema migration | Adds Program-level persisted subject-code color maps used for automatic/default course colors across the UI. |
| 20260313_0003_add_course_color_column.py | Schema migration | Backfills the missing legacy `courses.color` override column so older SQLite databases match the current Course model. |
| 20260314_0004_add_course_resource_files.py | Schema migration | Adds `course_resource_files` so course resources can persist file metadata while bytes stay on local disk. |
| 20260314_0005_add_course_resource_links.py | Schema migration | Extends `course_resource_files` with link-only resource fields so Course Resources can store external URLs without local file bytes. |
| 20260314_0006_add_lms_integrations.py | Schema migration | Adds provider-neutral `lms_integrations` rows for encrypted LMS connection storage. |
| 20260314_0007_expand_lms_integrations.py | Schema migration | Expands LMS support to multiple integrations per user, Program-level LMS selection, and dedicated `course_lms_links` metadata. |
