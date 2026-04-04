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
| 20260315_0008_add_gradebook_lms_assignment_source.py | Schema migration | Adds optional LMS provenance columns on `gradebook_assessments` so one-time LMS assignment imports can avoid duplicate local rows without enabling sync. |
| 20260321_0009_add_gradebook_points_fields.py | Schema migration | Adds nullable earned/possible points columns on `gradebook_assessments` so the UI can accept point-based grading input while the backend still persists derived percentages. |
| 20260323_0010_add_auth_security_controls.py | Schema migration | Adds `users.session_version` for server-enforced logout revocation plus persistent `auth_rate_limits` rows for database-backed login throttling. |
| 20260326_0011_add_program_plugin_governance.py | Schema migration | Adds Program plugin installation tables, Semester plugin activation tables, and draft-lifecycle plus `review_ready` columns on `semesters` for the resumable Create Semester wizard. |
| 20260327_0012_add_widget_title.py | Schema migration | Restores first-class `widgets.title` persistence so widget CRUD responses preserve user-visible titles. |
| 20260327_0013_repair_runtime_schema_drift.py | Schema migration | Repairs drifted local SQLite databases that were stamped to head while still missing `semesters.review_ready`, so Program/Semester reads no longer fail at runtime. |
| 20260327_0014_add_plugin_enabled_flags.py | Schema migration | Adds `is_enabled` flags to Program plugin installations and Semester plugin activations so disable preserves data while delete still removes it. |
| 20260327_0015_add_single_draft_index.py | Schema migration | Adds a partial unique index on `semesters.program_id` for `lifecycle_state = 'draft'` so each Program can have only one in-progress Semester draft. |
| 20260328_0016_add_program_course_plugin_activations.py | Schema migration | Adds `program_course_plugin_activations` so unassigned Courses can store lightweight per-course plugin enablement without introducing full Course-level plugin settings/setup state. |
| 20260329_0017_add_tab_settings_and_workspace_tab_orders.py | Schema migration | Adds V2 `tab_settings` plus `workspace_tab_order_entries`, backfills single-tab Program installation settings into Program-scoped tab settings, preserves assigned-course tab overrides while moving shared course tab order into semester buckets, reads plugin ownership from checked-in plugin descriptors, and now self-heals duplicate or divergent legacy assigned-course tab rows instead of aborting local SQLite upgrades. |
| 20260330_0018_drop_plugin_settings_table.py | Schema migration | Drops the obsolete `plugin_settings` table now that Plugin System V2 uses Program governance plus `tab_settings` instead of framework-managed Semester/Course plugin shared-settings rows. |
| 20260331_0019_add_email_verification_challenges.py | Schema migration | Adds `users.email_verified_at` plus persisted `email_verification_challenges` storage for Resend-backed auth email-code registration, email-code login, and password-reset flows. |
| 20260402_0020_drop_legacy_plugin_setting_columns.py | Schema migration | Drops the obsolete `program_plugin_installations.program_settings` and `semester_plugin_activations.semester_overrides` columns so inherited plugin settings now flow only through `tab_settings`. |
| 20260402_0021_rename_tab_settings_key_column.py | Schema migration | Renames `tab_settings.tab_type` to `settings_key` so plugin configuration buckets are no longer semantically tied to runtime tab ids. |
| 20260402_0022_drop_semester_plugin_setup_state.py | Schema migration | Drops the obsolete `semester_plugin_activations.setup_state` column after semester plugin setup moved fully into `tab_settings`. |
| 20260404_0023_drop_legacy_course_event_types_table.py | Schema migration | Drops the legacy `course_event_types` table plus old course-section and course-event foreign keys now that builtin event types are sourced only from `tab_settings`. |
