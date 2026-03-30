<!-- ⚠️ Once this folder changes, update me. -->

`docs/` stores product planning, refactor execution notes, plugin requirements, and operational security notes for Semestra.
These documents define implementation scope, acceptance criteria, rollout constraints, and key implementation decisions.
They are the source of truth for delivery sequencing and human-readable project guidance before and after code changes land.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Documentation index | Architecture summary and file-level catalog for `docs/`. |
| alembic.md | Backend migration note | Short guide for the new Alembic-based schema migration workflow and why runtime schema rewrite code was removed. |
| auth-security-explained.md | Security note | Plain-language explanation of JWT secret management, CSRF-protected HttpOnly cookie sessions, logout revocation, deployment settings, and the March 2026 auth hardening change. |
| PLUGIN_DEVELOPMENT.md | Plugin guide | Developer guide for backend-owned plugin identity/governance, frontend plugin manifests and contribution catalogs, the `supportsUnassignedCourse` capability for unassigned-Course governance, Program/Semester/Course plugin-global settings authoring plus Program `program_settings` persistence semantics, plugin setup authoring in DSL-or-custom-UI mode plus manifest generation, a public plugin API reference table for `@/plugin-system` and its thin entrypoints, unified runtime tab/widget typing from the same public surface, runtime/global-settings registration, wizard setup contracts, and runtime host APIs such as confirmed tab jumps and plugin-local UI-state caching. |
| plugin-inheritance-architecture.md | Architecture note | Mermaid-backed explanation of the separate activation and settings chains, including Program installation, Semester activation, unassigned-Course activation, Course-scoped settings, runtime assembly, and the `supports_unassigned_course` capability path. |
| fix-dashboard-edit-mode-widget-reload.md | Bug fix spec | Records issue context and fix approach for dashboard edit-mode widget reload behavior. |
| timetable_refactoring_plan_optimized.md | Refactor plan | Optimized plan for timetable plugin refactor phases, architecture, and acceptance checkpoints. |
| todolist.md | Execution checklist | Actionable progress checklist for builtin timetable refactor tasks. |
| prd-deadline-radar.md | Product requirements | Production-grade PRD for Deadline Radar plugin covering scope, data, API, quality, and rollout. |
| prd-gpa-goal-planner.md | Product requirements | Production-grade PRD for GPA Goal Planner plugin with deterministic formula and scenario governance. |
| prd-focus-pomodoro.md | Product requirements | Production-grade PRD for Focus Pomodoro plugin including timer engine, reliability, and analytics. |
| prd-plugin-system-v2.md | Product requirements | Formal PRD for the next-generation plugin system, defining host-reserved tabs, multi-tab and multi-widget package contributions, tab-type settings inheritance, widget instance boundaries, scope-based read and write rules, shared and independent ordering buckets, and host-managed availability and tab-jump behavior. |
| pomodoro-widget-plan.md | Implementation plan | End-to-end implementation plan for Pomodoro widget plugin registration, timer engine, UI, settings, tests, and acceptance criteria. |
