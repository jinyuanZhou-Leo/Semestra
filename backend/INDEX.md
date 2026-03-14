<!-- ⚠️ Once this folder changes, update me. -->

Backend exposes FastAPI endpoints and coordinates auth, CRUD, and domain logic.
Data contracts are defined in Pydantic schemas and persisted through SQLAlchemy models, with Alembic now owning schema evolution instead of startup-time compatibility rewrites.
Auth now signs JWTs from env-backed secrets and ships browser sessions via HttpOnly cookies while still validating bearer tokens server-side.
Program-level subject-code color maps now persist in the backend as stable locked assignments so Course List, Program Dashboard, Course Settings, Todo, and backups share the same automatic/default course colors while new subject codes avoid collisions when palette room remains.
Course resources now store file metadata in SQLite, file bytes on local disk, saved external URLs as link-only records, and enforce a 50MB account-wide quota across every course resource upload.
LMS integrations now persist one encrypted provider-neutral connection per user/provider, validate Canvas PATs through a provider adapter, and expose generic read-only connection/course APIs without leaking secrets.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Folder architecture | Backend folder architecture summary and file responsibility map. |
| .env.example | Environment template | Example backend environment variables for local setup, including JWT secret and auth-cookie settings. |
| alembic/ | Migration workspace | Alembic environment and revision history for backend schema changes, including legacy SQLite backfills for missing `programs.subject_color_map`, `courses.color`, `course_resource_files`, and `lms_integrations` schema on older deployments. |
| alembic.ini | Migration config | Alembic CLI configuration pointing at the backend migration workspace. |
| auth.py | Auth utility | Handles JWT creation/validation, secure auth-cookie helpers, and current-user resolution from cookie or bearer token. |
| color_utils.py | Color utility | Shared subject-code parsing, automatic color assignment, and Program subject-color-map serialization helpers used by CRUD and Todo flows. |
| course_resources.py | Resource domain service | Owns account-wide course-resource quota accounting, local-disk file persistence, saved-link validation, mime/disposition helpers, and metadata mutations for course resources. |
| crud.py | Data access | Implements database CRUD for users, tasks, courses, widgets, plugin shared settings, and user settings including the background plugin preload preference default/normalization path. |
| database.py | DB bootstrap | Configures SQLAlchemy engine/session and database base metadata. |
| gradebook.py | Gradebook domain service | Owns built-in gradebook initialization, fact-only preference/category/assessment mutations, percentage-score persistence, and import/export mapping without persisting forecast or plan results onto the course. |
| lms_canvas.py | Canvas adapter | Implements the Canvas provider adapter that normalizes PAT-backed user summaries and read-only course listings through `canvasapi`. |
| lms_crypto.py | LMS crypto utility | Encrypts and decrypts provider credentials with a versioned AES-GCM payload backed by `LMS_CREDENTIALS_ENCRYPTION_KEY`. |
| lms_providers.py | LMS provider contract | Defines provider-neutral DTOs, provider errors, and the registry that resolves supported LMS adapters such as Canvas. |
| lms_service.py | LMS orchestration | Owns encrypted LMS connection persistence, stored validation state transitions, provider dispatch, and generic course list responses. |
| logic.py | Domain logic | Provides GPA and grading-related business logic helpers. |
| main.py | API entry point | Defines FastAPI app, middleware, HTTP route handlers, auth login/logout cookie issuance, provider-neutral LMS connect/validate/list/delete endpoints, Program subject-color-map persistence, account-wide course-resource upload/list/link/create/rename/delete/download APIs, backup import/export, semester Reading Week validation, semester todo APIs, plugin shared settings endpoints, gradebook APIs, and force-aware widget deletion without runtime schema rewrite helpers. |
| migrate_add_category.py | Migration script | Adds widget category support to existing database schema. |
| migrate_add_program_id_to_course.py | Migration script | Adds `program_id` to courses and related constraints. |
| migrate_user_settings.py | Migration script | Creates and backfills user settings columns and defaults. |
| migrate_week_pattern_to_alternating.py | Migration script | Migrates week pattern model to alternating-week structure. |
| models.py | ORM models | Defines SQLAlchemy table models and relational constraints, including Program-level subject color maps, encrypted provider-neutral LMS integration rows, persisted course overrides, course resource file metadata, optional semester Reading Week dates, context-scoped plugin shared settings records, semester todo tables, and gradebook domain tables. |
| prod.sh | Ops script | Production deploy script that updates code, installs dependencies, loads the systemd env file, runs Alembic against the service database, and restarts the backend service. |
| requirements.txt | Dependency manifest | Lists Python runtime dependencies required by backend, including `canvasapi` for Canvas LMS connectivity. |
| schemas.py | API schema layer | Defines request/response validation models, including Program subject-color settings, provider-neutral LMS connection/course payloads, course-resource list/upload/link/rename payloads, semester todo payloads, persisted course-color fields, plugin shared settings payloads, user setting update fields such as background plugin preload, strict widget `layout_config` shape/range validation, and fact-oriented gradebook contracts. |
| test_course_resources.py | Unit test script | Verifies account-wide course-resource quota accounting plus file and saved-link resource persistence behavior. |
| test_lms_integrations.py | Unit test script | Verifies LMS credential encryption metadata, non-overwriting upsert semantics, stored validation error transitions, and paginated course responses. |
| todo.py | Todo domain service | Owns semester-scoped todo migration from legacy tab settings plus task/section CRUD and API payload assembly without backend order persistence, while resolving stable Program default course colors for Todo tags. |
| test_crud.py | Integration test script | Verifies CRUD workflows against a running local API. |
| test_gradebook.py | Unit test script | Verifies builtin gradebook initialization, category reassignment, preference updates, percentage-score persistence, and that gradebook mutations no longer overwrite course grade fields. |
| test_logic.py | Integration test script | Verifies academic logic flows against API endpoints. |
| test_nickname.py | Integration test script | Validates nickname update and retrieval API behavior. |
| test_todo.py | Unit test script | Verifies table-backed todo payloads no longer expose persisted order fields, Program subject-color defaults flow into Todo course options, locked subject-color assignments stay stable for new codes, and section moves are handled through regular task updates. |
| test_widget_delete.py | Integration test script | Validates widget deletion endpoint behavior. |
| test_widget_update.py | Integration test script | Validates widget update endpoint behavior. |
| utils.py | Shared utility | Provides timetable parsing, ICS conversion, and date helpers. |
