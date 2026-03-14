<!-- ⚠️ Once this folder changes, update me. -->

`src/plugins/` contains plugin implementations that extend dashboard widgets and homepage tabs.
Each plugin folder provides runtime entrypoints, metadata catalog declarations, and optional plugin-global settings/test files.
The plugin-system auto-loads `metadata.ts` eagerly, `settings.ts(x)` eagerly, and `index.ts` lazily per plugin.

**Conventions:**
- `metadata.ts` default-exports `definePluginMetadata(...)` and is the **single source of truth** for `name`, `description`, `icon`, `layout`, `maxInstances`, and `allowedContexts`.
- `index.ts` default-exports `definePluginRuntime(...)`; runtime definitions in `widget.tsx`/`tab.tsx` declare runtime-specific fields like `component`, `defaultSettings`, tab/widget `SettingsComponent`, `headerButtons`, and lifecycle hooks.
- `settings.ts(x)` is **optional** and default-exports `definePluginSettings(...)` only when the plugin defines shared plugin-level settings sections.
- Regular plugins can use framework-managed shared settings through `PluginSettingsProps.settings` and `updateSettings(...)`; builtin plugins may still keep host-coupled custom APIs where needed.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local plugin folder architecture and plugin catalog map. |
| builtin-dashboard/ | Built-in tab plugin | Default dashboard tab plugin implementation and settings entry. |
| builtin-dashboard/INDEX.md | Plugin architecture index | File map for built-in dashboard tab runtime with light-mode light-green glass active FAB surface, dark-mode deep-green active surface, and shadowless dark-mode tuning, plus metadata/settings/runtime contracts. |
| builtin-event-core/ | Built-in domain plugin | Core calendar/course/todo tab suite and shared schedule logic. |
| builtin-event-core/INDEX.md | Plugin architecture index | File map for event-core plugin entries, shared domain primitives, scoped refresh payloads, retrying todo sync, and tab/widget runtime responsibilities. |
| builtin-gradebook/ | Built-in grade domain plugin | Course gradebook tab and read-only course-metrics widget backed by fact-only gradebook APIs with client-derived projections and validation. |
| builtin-gradebook/INDEX.md | Plugin architecture index | File map for the builtin-gradebook command-center tab, moved course stat strip, stable fixed-height Plan Mode toolbar layout, clarified forecast settings UI, compact course-metrics widget, grade-calculator-style dashboard-stat syncing after gradebook saves, shared client-side gradebook calculators, and backend gradebook integration. |
| builtin-settings/ | Built-in tab plugin | Default settings tab plugin implementation and settings entry. |
| builtin-settings/INDEX.md | Plugin architecture index | File map for the built-in Settings tab runtime and its dynamic sticky-title offset behavior. |
| counter/ | Widget plugin | Numeric counter widget with inline controls and per-instance settings. |
| counter/INDEX.md | Plugin architecture index | File map for counter plugin runtime, metadata, settings, bound validation, and design notes. |
| course-resources/ | Course resource plugin | Course-only resource manager tab plus pinned quick-open widget backed by account-wide resource quota APIs. |
| course-list/ | Widget plugin | Course list widget with plugin-level management settings panel. |
| course-list/INDEX.md | Plugin architecture index | File map for course-list plugin runtime, metadata, plugin-global settings, explicit async loading/error feedback, and guarded course-manager entry behavior. |
| habit-streak/ | Widget plugin | Habit streak dual-widget plugin with per-instance streak data, split Duolingo/ring widget definitions, mode-specific settings, reward bursts, and tests. |
| habit-streak/INDEX.md | Plugin architecture index | File map for habit-streak per-instance state helpers, split widget files, same-day-safe streak handling, accessible action labels, reduced-motion wiring, and burst animation behavior. |
| pomodoro/ | Widget plugin | Pomodoro focus timer widget with session transitions and tests. |
| sticky-note/ | Widget plugin | Sticky note widget with editable content and header actions. |
| tab-template/ | Template plugin | Starter template showing tab plugin structure, runtime settings, and host-decoupled contracts. |
| tab-template/INDEX.md | Plugin architecture index | File map for the starter tab plugin showing metadata, runtime, and tab instance settings contracts. |
| world-clock/ | Widget plugin | Timezone clock widget with display preferences and settings UI. |
| world-clock/INDEX.md | Plugin architecture index | File map for world-clock runtime, settings, locale-aware formatting, and cadence behavior. |
