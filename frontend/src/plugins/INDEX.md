<!-- ⚠️ Once this folder changes, update me. -->

`src/plugins/` contains plugin implementations that extend workspace widgets and homepage tabs.
Each plugin folder provides runtime entrypoints, plugin-manifest declarations, contribution catalogs, optional Semester setup definitions, and optional plugin-global settings/test files.
The plugin-system auto-loads `metadata.ts`, `setup.ts(x)`, and `settings.ts(x)` eagerly, and `index.ts` lazily per plugin.

**Conventions:**
- `metadata.ts` default-exports `definePluginMetadata(...)` and is the frontend source of truth for plugin display metadata plus tab/widget contribution catalogs, including `supportsUnassignedCourse` for unassigned-Course compatibility.
- `setup.ts(x)` is **optional** and default-exports `definePluginSetup(...)` only when the plugin contributes Semester setup sections, validation, or custom setup/review UI to the plugin-system manifest.
- Backend plugin governance consumes the generated metadata manifest so Program/Semester/unassigned-Course management surfaces stay aligned with frontend-authored plugin display metadata.
- `index.ts` default-exports `definePluginRuntime(...)`; runtime definitions in `widget.tsx`/`tab.tsx` declare runtime-specific fields like `component`, `defaultSettings`, tab/widget `SettingsComponent`, `headerButtons`, and lifecycle hooks.
- `settings.ts(x)` is **optional** and default-exports `definePluginSettings(...)` only when the plugin defines plugin-level settings sections for Program, Semester, or Course settings pages.
- Settings sections receive scope ids and shared shell props from the host, but persistence is plugin-owned; transient per-instance UI state should still use the plugin UI-state hook instead of backend persistence.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local plugin folder architecture and plugin catalog map. |
| builtin-dashboard/ | Built-in tab plugin | Default dashboard tab plugin implementation and settings entry, with edit-mode state stored as plugin-local UI state instead of ad hoc localStorage and explicit unassigned-Course support. |
| builtin-canvas-integration/ | Built-in tab plugin | Canvas-only course navigation tab with a sticky left-side course menu, first-class Assignments and Canvas-backed Grades views, a standalone Gradebook handoff card routed through the host jump API, default-view-backed Home fallback routing, special Announcements/Modules/Pages/Quizzes/Syllabus views, expanded-by-default module cards that render inline item titles from the main modules payload, shrink-safe content-shell sizing that prevents intermediate-width horizontal overflow, CTA-only handling for unknown internal tabs plus external tools, in-app same-course page links, plugin-local navigation drafts, and explicit unassigned-Course support. |
| builtin-dashboard/INDEX.md | Plugin architecture index | File map for built-in dashboard tab runtime with light-mode light-green glass active FAB surface, dark-mode deep-green active surface, and shadowless dark-mode tuning, plus metadata/settings/runtime contracts. |
| builtin-event-core/ | Built-in domain plugin | Core calendar/course/todo tab suite, Semester setup onboarding entry, and shared schedule logic. |
| builtin-event-core/INDEX.md | Plugin architecture index | File map for event-core plugin entries, Semester setup definitions, shared domain primitives, scoped refresh payloads, retrying todo sync, and tab/widget runtime responsibilities. |
| builtin-gradebook/ | Built-in grade domain plugin | Course gradebook tab and read-only course-metrics widget backed by fact-only gradebook APIs with client-derived projections, validation, plugin-local persisted Plan Mode drafts, and explicit unassigned-Course support. |
| builtin-gradebook/INDEX.md | Plugin architecture index | File map for the builtin-gradebook command-center tab, moved course stat strip, stable fixed-height Plan Mode toolbar layout, persisted What If drafts, clarified forecast settings UI, compact course-metrics widget, grade-calculator-style dashboard-stat syncing after gradebook saves, shared client-side gradebook calculators, and backend gradebook integration. |
| builtin-setting/ | Built-in tab plugin | Default settings tab plugin implementation and settings entry with explicit unassigned-Course support. |
| builtin-setting/INDEX.md | Plugin architecture index | File map for the built-in Settings tab runtime and its dynamic sticky-title offset behavior. |
| counter/ | Widget plugin | Numeric counter widget with inline controls, per-instance settings, and explicit unassigned-Course support. |
| counter/INDEX.md | Plugin architecture index | File map for counter plugin runtime, metadata, settings, bound validation, and design notes. |
| course-resources/ | Course resource plugin | Course-only resource manager tab plus pinned quick-open widget backed by account-wide resource quota APIs, with a height-stable add-resource dialog whose link form uses plugin-local UI state and explicit unassigned-Course support. |
| course-list/ | Widget plugin | Course list widget with semester-scoped course cards and quick navigation links. |
| course-list/INDEX.md | Plugin architecture index | File map for course-list plugin runtime, metadata, explicit async loading/error feedback, and shared GPA-percentage formatting. |
| habit-streak/ | Widget plugin | Habit streak dual-widget plugin with per-instance streak data, split Duolingo/ring widget definitions, mode-specific settings, reward bursts, tests, and explicit unassigned-Course support. |
| habit-streak/INDEX.md | Plugin architecture index | File map for habit-streak per-instance state helpers, split widget files, same-day-safe streak handling, accessible action labels, reduced-motion wiring, and burst animation behavior. |
| pomodoro/ | Widget plugin | Pomodoro focus timer widget with session transitions, tests, and explicit unassigned-Course support. |
| sticky-note/ | Widget plugin | Sticky note widget with editable content, header actions, and explicit unassigned-Course support. |
| tab-template/ | Template plugin | Starter template showing tab plugin structure, runtime settings, and host-decoupled contracts. |
| tab-template/INDEX.md | Plugin architecture index | File map for the starter tab plugin showing metadata, runtime, and tab instance settings contracts. |
| world-clock/ | Widget plugin | Timezone clock widget with display preferences, settings UI, and explicit unassigned-Course support. |
| world-clock/INDEX.md | Plugin architecture index | File map for world-clock runtime, settings, locale-aware formatting, and cadence behavior. |
