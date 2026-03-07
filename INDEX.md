<!-- ⚠️ Once this folder changes, update me. -->

Semestra is a full-stack scheduling and academic planner with a Python backend and modern web frontend.
`backend/` provides FastAPI APIs, data models, persistence, and schema-level widget layout validation.
`frontend/` provides the user interface, including RGL v2 container-width-based widget sizing, lower-frequency resize-guarded relayouts, zero-width mount protection on dashboard remount, optional aspect-ratio constraints, context-safe optimistic dashboard sync, stale-response-safe fetch flows, semantic-token dashboard FAB surfaces tuned with light-mode light-green glass active edit state, deep-green dark mode, and shadowless dark mode, class-driven dark-variant behavior aligned with `ThemeProvider`, softened lower-opacity widget header controls with direct touch edit-mode actions, skeleton-first plugin loading with fade-in completion for tabs/widgets, refined habit-streak calendar-first/classic-ring views with recent-history-backed tracking and lighter burst effects, plus hardened plugin UX around explicit course-list feedback, calendar conflict details, overlap-safe week layout, guarded todo flows, validated counter ranges, and locale-aware world-clock formatting.

| File/Folder | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Top-level system architecture map for the repository. |
| .vscode | Editor workspace config | VS Code workspace settings aligned with Tailwind v4 CSS linting and the frontend-local TypeScript SDK. |
| README.md | Product overview | Main project introduction, setup, and usage guide. |
| README.zh-CN.md | Product overview (CN) | Chinese version of project introduction and setup notes. |
| backend | Service backend | FastAPI service, SQLAlchemy models, business logic, migrations, and widget payload validation. |
| docs | Project docs | Supplemental product, API, and workflow documentation. |
| docs/INDEX.md | Docs architecture index | File-level map for planning docs, refactor checklists, and plugin PRDs. |
| docs/prd-deadline-radar.md | Plugin PRD | Production requirements for Deadline Radar plugin. |
| docs/prd-gpa-goal-planner.md | Plugin PRD | Production requirements for GPA Goal Planner plugin. |
| docs/prd-focus-pomodoro.md | Plugin PRD | Production requirements for Focus Pomodoro plugin. |
| docs/pomodoro-widget-plan.md | Plugin implementation plan | Execution plan for Pomodoro widget implementation, registration, settings, and testing. |
| frontend | Web client | User-facing application code, frontend build assets, responsive widget dashboard UX with RGL v2 width hooks, lower-frequency resize-guarded relayout behavior, zero-width mount protection, stale-response-safe data fetch hooks, semantic-token dashboard FAB surfaces, skeleton-first lazy plugin loading, refined habit-streak calendar/ring experiences, responsive semester/course workspace transitions, shared responsive dialog/drawer flows, and plugin UX/accessibility hardening for course-list, calendar, todo, counter, and world-clock surfaces. |
| frontend/INDEX.md | Frontend architecture index | Frontend subsystem map for routes, components, hooks, contexts, and services. |
| frontend/src/plugins/INDEX.md | Plugin architecture index | Plugin catalog map and per-plugin folder architecture references. |
| frontend/src/plugins/builtin-dashboard/INDEX.md | Plugin architecture index | File map for built-in Dashboard tab plugin runtime with light-mode light-green glass active FAB tuning, dark-mode deep-green active surface, and metadata/settings exports. |
| frontend/src/plugins/builtin-event-core/INDEX.md | Plugin architecture index | File map for event-core plugin entries, shared domain primitives, tab modules, and widget runtime responsibilities. |
| frontend/src/plugins/builtin-event-core/tabs/INDEX.md | Tab architecture index | File map for event-core tab module folders (calendar/course-schedule/todo). |
| frontend/src/plugins/builtin-event-core/tabs/calendar/INDEX.md | Calendar module architecture index | File map for calendar tab runtime, settings, export workflow, and helper components. |
| frontend/src/plugins/builtin-event-core/tabs/todo/INDEX.md | Todo module architecture index | File map for todo tab runtime, hooks, settings, and responsive interaction flows. |
| frontend/src/plugins/builtin-event-core/tabs/todo/components/INDEX.md | Todo components architecture index | File map for todo sidebar/header/task card components and dialog grouping. |
| frontend/src/plugins/counter/INDEX.md | Plugin architecture index | File map for counter plugin runtime, settings, and accessibility-focused controls. |
| frontend/src/plugins/course-list/INDEX.md | Plugin architecture index | File map for course-list plugin runtime, global settings, and guarded async loading. |
| frontend/src/plugins/habit-streak/INDEX.md | Plugin architecture index | File map for habit-streak helper logic, preset cadence locking, real recent-history cleanup, minimal calendar-first dual streak-view rendering, settings, and tests. |
| frontend/src/plugins/pomodoro | Widget plugin module | Pomodoro timer widget plugin with runtime, metadata, settings entry, tests, compact mode + completion summary UI, and reset-to-initial-focus behavior. |
| frontend/src/plugins/world-clock/INDEX.md | Plugin architecture index | File map for world-clock runtime and adaptive refresh cadence settings. |
| plugin-system | Extension subsystem | Plugin architecture resources and integration artifacts. |
| PLUGIN_DEVELOPMENT.md | Plugin guide | Developer guide for building and integrating plugins with the metadata/settings/runtime default-export contract, plugin-manager facade, eager metadata/settings loading, and lazy runtime registration. |
