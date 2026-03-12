<!-- ⚠️ Once this folder changes, update me. -->

`docs/` stores product planning, refactor execution notes, plugin requirements, and operational security notes for Semestra.
These documents define implementation scope, acceptance criteria, rollout constraints, and key implementation decisions.
They are the source of truth for delivery sequencing and human-readable project guidance before and after code changes land.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Documentation index | Architecture summary and file-level catalog for `docs/`. |
| alembic.md | Backend migration note | Short guide for the new Alembic-based schema migration workflow and why runtime schema rewrite code was removed. |
| auth-security-explained.md | Security note | Plain-language explanation of JWT secret management, HttpOnly cookie sessions, deployment settings, and the March 2026 auth hardening change. |
| fix-dashboard-edit-mode-widget-reload.md | Bug fix spec | Records issue context and fix approach for dashboard edit-mode widget reload behavior. |
| timetable_refactoring_plan_optimized.md | Refactor plan | Optimized plan for timetable plugin refactor phases, architecture, and acceptance checkpoints. |
| todolist.md | Execution checklist | Actionable progress checklist for builtin timetable refactor tasks. |
| prd-deadline-radar.md | Product requirements | Production-grade PRD for Deadline Radar plugin covering scope, data, API, quality, and rollout. |
| prd-gpa-goal-planner.md | Product requirements | Production-grade PRD for GPA Goal Planner plugin with deterministic formula and scenario governance. |
| prd-focus-pomodoro.md | Product requirements | Production-grade PRD for Focus Pomodoro plugin including timer engine, reliability, and analytics. |
| pomodoro-widget-plan.md | Implementation plan | End-to-end implementation plan for Pomodoro widget plugin registration, timer engine, UI, settings, tests, and acceptance criteria. |
