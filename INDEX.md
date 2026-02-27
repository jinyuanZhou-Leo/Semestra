<!-- ⚠️ Once this folder changes, update me. -->

Semestra is a full-stack scheduling and academic planner with a Python backend and modern web frontend.
`backend/` provides FastAPI APIs, data models, persistence, and schema-level widget layout validation.
`frontend/` provides the user interface, including RGL v2 container-width-based widget sizing, lower-frequency resize-guarded relayouts, zero-width mount protection on dashboard remount, optional aspect-ratio constraints, context-safe optimistic dashboard sync, stale-response-safe fetch flows, semantic-token dashboard FAB surfaces tuned with light-mode light-green glass active edit state, deep-green dark mode, and shadowless dark mode, class-driven dark-variant behavior aligned with `ThemeProvider`, softened lower-opacity widget header controls with direct touch edit-mode actions (no ellipsis gate), expanded short interval-agnostic streak motivation copy, softer light-mode habit-streak ring track contrast plus stronger center typography readability with subtle orbital ring motion, precomputed lower-cost streak burst particles for milestone and overachieve effects, plugin-directory-based dev HMR re-registration for immediate tab/widget style updates, non-wrapping/truncated header breadcrumbs with stable loading placeholders, collapsible hero stats beneath semester/course workspace headings, compact one-row mobile program overview metrics that keep semester content in the first screen, shrink-state tab selectors that translate right/up beside the heading in sync with stat collapse, and mobile-safe settings layout controls that avoid horizontal overflow.

| File/Folder | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Top-level system architecture map for the repository. |
| README.md | Product overview | Main project introduction, setup, and usage guide. |
| README.zh-CN.md | Product overview (CN) | Chinese version of project introduction and setup notes. |
| backend | Service backend | FastAPI service, SQLAlchemy models, business logic, migrations, and widget payload validation. |
| docs | Project docs | Supplemental product, API, and workflow documentation. |
| docs/INDEX.md | Docs architecture index | File-level map for planning docs, refactor checklists, and plugin PRDs. |
| docs/prd-deadline-radar.md | Plugin PRD | Production requirements for Deadline Radar plugin. |
| docs/prd-gpa-goal-planner.md | Plugin PRD | Production requirements for GPA Goal Planner plugin. |
| docs/prd-focus-pomodoro.md | Plugin PRD | Production requirements for Focus Pomodoro plugin. |
| docs/pomodoro-widget-plan.md | Plugin implementation plan | Execution plan for Pomodoro widget implementation, registration, settings, and testing. |
| frontend | Web client | User-facing application code, frontend build assets, responsive widget dashboard UX with RGL v2 width hooks, lower-frequency resize-guarded relayout behavior, zero-width mount protection, stale-response-safe data fetch hooks, semantic-token dashboard FAB surfaces with light-mode light-green glass active edit state, deep-green dark mode, and shadowless dark mode, class-driven dark-variant behavior aligned with `ThemeProvider`, softer light-mode habit-streak ring track + center-text readability tuning with subtle orbital ring motion, precomputed lower-cost burst particle animation for milestone and overachieve effects, softened lower-opacity widget header controls with direct touch edit-mode actions (no ellipsis gate), plugin-directory-based dev HMR re-registration for immediate tab/widget updates, non-wrapping header breadcrumb behavior with truncation/loading placeholders, collapsible hero stats beneath semester/course headings, compact one-row mobile program overview metrics on Program Homepage, shrink-state tab selectors that translate right/up beside the heading in sync with stat collapse, context-key-scoped local-sync plus commit-persistence layout callbacks, and mobile-safe settings overflow protections. |
| frontend/INDEX.md | Frontend architecture index | Frontend subsystem map for routes, components, hooks, contexts, and services. |
| frontend/src/plugins/INDEX.md | Plugin architecture index | Plugin catalog map and per-plugin folder architecture references. |
| frontend/src/plugins/builtin-dashboard/INDEX.md | Plugin architecture index | File map for built-in Dashboard tab plugin runtime with light-mode light-green glass active FAB tuning, dark-mode deep-green active surface, and metadata/settings exports. |
| frontend/src/plugins/builtin-event-core/INDEX.md | Plugin architecture index | File map for event-core plugin entries, shared domain primitives, tab modules, and widget runtime responsibilities. |
| frontend/src/plugins/builtin-event-core/tabs/INDEX.md | Tab architecture index | File map for event-core tab module folders (calendar/course-schedule/todo). |
| frontend/src/plugins/builtin-event-core/tabs/calendar/INDEX.md | Calendar module architecture index | File map for calendar tab runtime, settings, export workflow, and helper components. |
| frontend/src/plugins/counter/INDEX.md | Plugin architecture index | File map for counter plugin runtime, settings, and accessibility-focused controls. |
| frontend/src/plugins/course-list/INDEX.md | Plugin architecture index | File map for course-list plugin runtime, global settings, and guarded async loading. |
| frontend/src/plugins/habit-streak/INDEX.md | Plugin architecture index | File map for habit-streak helper logic, softer light-mode ring track + center-text readability tuning, expanded short interval-agnostic motivation copy, settings, and tests. |
| frontend/src/plugins/pomodoro | Widget plugin module | Pomodoro timer widget plugin with runtime, metadata, settings entry, tests, compact mode + completion summary UI, and reset-to-initial-focus behavior. |
| frontend/src/plugins/world-clock/INDEX.md | Plugin architecture index | File map for world-clock runtime and adaptive refresh cadence settings. |
| plugin-system | Extension subsystem | Plugin architecture resources and integration artifacts. |
| PLUGIN_DEVELOPMENT.md | Plugin guide | Developer guide for building and integrating plugins, including widget spacing and streamlined UI guidelines. |
