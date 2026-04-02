<!-- ⚠️ Once this folder changes, update me. -->

`src/plugins/` contains plugin implementations that extend workspace widgets and homepage tabs.
Each plugin folder is now structured around one typed `plugin.ts` authoring entry plus a lazily loaded `index.ts` runtime entry.
The frontend eagerly scans `plugin.ts` for catalog metadata and setup bindings, while the build script serializes the same source into backend-readable generated manifests.
Private host-only kind and visibility rules remain in `host-policy.json`, outside the public plugin authoring contract.
Plugin settings authoring is intentionally restricted to two places: plugin settings for tabs or host-rendered settings pages live in optional `settings.tsx`, while widget instance settings stay co-located with the owning runtime definition in `widget.tsx`.

**Conventions:**
- `plugin.ts` is the single frontend authoring entrypoint and default-exports `definePlugin(...)`, declaring plugin identity plus `tabs`, `widgets`, optional `settings.panels`, lazy runtime loading, and any optional settings/setup UI modules in one place.
- `plugin.ts` is the source of truth for plugin authoring; handwritten `plugin.json` source files are no longer part of the plugin workflow.
- `host-policy.json` is the private host overlay for builtin/host-shell kind and visibility; external plugin authors do not declare those fields in `plugin.ts`.
- `definePluginManifest(...)` keeps inline plugin metadata typed, including direct lucide icon imports.
- Semester setup is authored in `setup.tsx` with `definePluginSetup(...)`, then bound from `plugin.ts` through `createPluginSetupBinding(...)`.
- `settings.tsx` is **optional** and owns plugin settings UI, including tab settings and host-rendered Program/Semester/Course plugin settings sections; do not keep empty placeholder files.
- Any settings section declared in `settings.tsx` must also be declared in `descriptor.settings.panels` inside `plugin.ts`, otherwise plugin validation fails before runtime load.
- `index.ts` default-exports `definePluginRuntime(...)`; runtime definitions in `widget.tsx`/`tab.tsx` declare runtime-specific fields like `component`, `defaultSettings`, tab/widget `SettingsComponent`, `headerButtons`, and lifecycle hooks.
- `tab.tsx` should import tab settings components from `settings.tsx` instead of declaring them inline, so tab settings stay in one plugin-owned location.
- Runtime instance settings still belong in `widget.tsx` through `SettingsComponent`; widget settings are the only plugin settings that remain instance-scoped.
- Settings sections receive scope ids and shared shell props from the host, but persistence is plugin-owned; transient per-instance UI state should still use the plugin UI-state hook instead of backend persistence.
- `frontend/scripts/generate-plugin-manifests.ts` emits `backend/generated/plugin-manifests/*.plugin.json` and optional `*.setup.schema.json` from these `plugin.ts` files for backend startup and migrations, while inherited tab settings are defined by runtime tab owners instead of manifest-level defaults/schema fields.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local plugin folder architecture and plugin catalog map. |
| host-policy.json | Host overlay | Private builtin/host-shell kind plus visibility policy consumed by both frontend and backend loaders. |
| builtin-dashboard/ | Built-in tab plugin | Default dashboard host-shell tab plugin with descriptor-backed metadata and tab-session-scoped edit-mode state stored through the plugin UI-state helper instead of ad hoc localStorage. |
| builtin-canvas-integration/ | Built-in tab plugin | Canvas-only course navigation tab with a sticky left-side course menu, first-class Assignments and Canvas-backed Grades views, a standalone Gradebook handoff card routed through the host jump API, default-view-backed Home fallback routing, special Announcements/Modules/Pages/Quizzes/Syllabus views, expanded-by-default module cards that render inline item titles from the main modules payload, shrink-safe content-shell sizing that prevents intermediate-width horizontal overflow, CTA-only handling for unknown internal tabs plus external tools, and in-app same-course page links plus plugin-local navigation drafts. |
| builtin-dashboard/INDEX.md | Plugin architecture index | File map for built-in dashboard tab runtime with light-mode light-green glass active FAB surface, dark-mode deep-green active surface, shadowless dark-mode tuning, and tab-exit edit-mode reset behavior, plus metadata/settings/runtime contracts. |
| builtin-event-core/ | Built-in domain plugin | Core calendar/course/todo tab suite, Semester setup onboarding entry, and shared schedule logic. |
| builtin-event-core/INDEX.md | Plugin architecture index | File map for event-core plugin entries, Semester setup definitions, shared domain primitives, scoped refresh payloads, retrying todo sync, and tab/widget runtime responsibilities. |
| builtin-gradebook/ | Built-in grade domain plugin | Course gradebook tab and read-only course-metrics widget backed by fact-only gradebook APIs with client-derived projections, validation, and plugin-local persisted Plan Mode drafts. |
| builtin-gradebook/INDEX.md | Plugin architecture index | File map for the builtin-gradebook command-center tab, moved course stat strip, stable fixed-height Plan Mode toolbar layout, persisted What If drafts, clarified forecast settings UI, compact course-metrics widget, grade-calculator-style dashboard-stat syncing after gradebook saves, shared client-side gradebook calculators, and backend gradebook integration. |
| builtin-setting/ | Built-in tab plugin | Default settings host-shell tab plugin with descriptor-backed metadata. |
| builtin-setting/INDEX.md | Plugin architecture index | File map for the built-in Settings tab runtime and its dynamic sticky-title offset behavior. |
| counter/ | Widget plugin | Numeric counter widget with inline controls and per-instance settings. |
| counter/INDEX.md | Plugin architecture index | File map for counter plugin runtime, metadata, settings, bound validation, and design notes. |
| course-resources/ | Course resource plugin | Course-only resource manager tab plus pinned quick-open widget backed by account-wide resource quota APIs, with a height-stable add-resource dialog whose link form uses plugin-local UI state. |
| course-resources/INDEX.md | Plugin architecture index | File map for course-resources runtime, typed metadata, and shared file-management helpers. |
| course-list/ | Widget plugin | Course list widget with semester-scoped course cards and quick navigation links. |
| course-list/INDEX.md | Plugin architecture index | File map for course-list plugin runtime, metadata, explicit async loading/error feedback, and shared GPA-percentage formatting. |
| habit-streak/ | Widget plugin | Habit streak dual-widget plugin with per-instance streak data, split Duolingo/ring widget definitions, mode-specific settings, reward bursts, and tests. |
| habit-streak/INDEX.md | Plugin architecture index | File map for habit-streak per-instance state helpers, split widget files, same-day-safe streak handling, accessible action labels, reduced-motion wiring, and burst animation behavior. |
| pomodoro/ | Widget plugin | Pomodoro focus timer widget with session transitions and tests. |
| sticky-note/ | Widget plugin | Sticky note widget with editable content and header actions. |
| sticky-note/INDEX.md | Plugin architecture index | File map for sticky-note runtime, typed metadata, and note-editing behavior. |
| tab-template/ | Template plugin | Starter template showing tab plugin structure, plugin-owned settings, a DSL-only setup flow that covers every host-rendered setup field type, and host-decoupled contracts. |
| tab-template/INDEX.md | Plugin architecture index | File map for the starter tab plugin showing metadata, runtime, plugin-owned tab settings, and wizard setup contracts. |
| world-clock/ | Widget plugin | Timezone clock widget with display preferences and settings UI. |
| world-clock/INDEX.md | Plugin architecture index | File map for world-clock runtime, settings, locale-aware formatting, and cadence behavior. |
