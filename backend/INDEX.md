<!-- ⚠️ Once this folder changes, update me. -->

Backend exposes FastAPI endpoints and coordinates auth, CRUD, and domain logic.
Data contracts are defined in Pydantic schemas and persisted through SQLAlchemy models, including context-scoped plugin shared settings.
Auth now signs JWTs from env-backed secrets and ships browser sessions via HttpOnly cookies while still validating bearer tokens server-side.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Folder architecture | Backend folder architecture summary and file responsibility map. |
| .env.example | Environment template | Example backend environment variables for local setup, including JWT secret and auth-cookie settings. |
| auth.py | Auth utility | Handles JWT creation/validation, secure auth-cookie helpers, and current-user resolution from cookie or bearer token. |
| crud.py | Data access | Implements database CRUD for users, tasks, courses, widgets, plugin shared settings, and user settings. |
| database.py | DB bootstrap | Configures SQLAlchemy engine/session and database base metadata. |
| gradebook.py | Gradebook domain service | Owns built-in gradebook initialization, fact-only note-free scenario/category/assessment mutations, solver math, and import/export mapping without persisting derived projections back onto the course. |
| logic.py | Domain logic | Provides GPA and grading-related business logic helpers. |
| main.py | API entry point | Defines FastAPI app, middleware, HTTP route handlers, auth login/logout cookie issuance, semester Reading Week validation/schema compatibility shims, plugin shared settings endpoints, gradebook APIs, and force-aware widget deletion. |
| migrate_add_category.py | Migration script | Adds widget category support to existing database schema. |
| migrate_add_program_id_to_course.py | Migration script | Adds `program_id` to courses and related constraints. |
| migrate_user_settings.py | Migration script | Creates and backfills user settings columns and defaults. |
| migrate_week_pattern_to_alternating.py | Migration script | Migrates week pattern model to alternating-week structure. |
| models.py | ORM models | Defines SQLAlchemy table models and relational constraints, including optional semester Reading Week dates, context-scoped plugin shared settings records, and gradebook domain tables. |
| prod.sh | Ops script | Production bootstrap script for backend service process startup. |
| requirements.txt | Dependency manifest | Lists Python runtime dependencies required by backend. |
| schemas.py | API schema layer | Defines request/response validation models, including semester Reading Week fields, plugin shared settings payloads, strict widget `layout_config` shape/range validation, and note-free fact-oriented gradebook contracts. |
| test_crud.py | Integration test script | Verifies CRUD workflows against a running local API. |
| test_gradebook.py | Unit test script | Verifies builtin gradebook initialization, category guards, due-date sorting, solver math, and that gradebook mutations no longer overwrite course grade fields. |
| test_logic.py | Integration test script | Verifies academic logic flows against API endpoints. |
| test_nickname.py | Integration test script | Validates nickname update and retrieval API behavior. |
| test_widget_delete.py | Integration test script | Validates widget deletion endpoint behavior. |
| test_widget_update.py | Integration test script | Validates widget update endpoint behavior. |
| utils.py | Shared utility | Provides timetable parsing, ICS conversion, and date helpers. |
