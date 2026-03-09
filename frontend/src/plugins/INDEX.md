<!-- ⚠️ Once this folder changes, update me. -->

`src/plugins/` contains plugin implementations that extend dashboard widgets and homepage tabs.
Each plugin folder provides runtime entrypoints, metadata catalog declarations, and optional settings/test files.
The plugin-system auto-loads `metadata.ts` eagerly, `settings.ts(x)` eagerly, and `index.ts` lazily per plugin.

**Conventions:**
- `metadata.ts` default-exports `definePluginMetadata(...)` and is the **single source of truth** for `name`, `description`, `icon`, `layout`, `maxInstances`, and `allowedContexts`.
- `index.ts` default-exports `definePluginRuntime(...)`; runtime definitions in `widget.tsx`/`tab.tsx` only declare runtime-specific fields like `component`, `defaultSettings`, widget `SettingsComponent`, `headerButtons`, and lifecycle hooks.
- `settings.ts(x)` is **optional** and default-exports `definePluginSettings(...)` when the plugin defines tab settings sections or widget global settings sections.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local plugin folder architecture and plugin catalog map. |
| builtin-dashboard/ | Built-in tab plugin | Default dashboard tab plugin implementation and settings entry. |
| builtin-dashboard/INDEX.md | Plugin architecture index | File map for built-in dashboard tab runtime with light-mode light-green glass active FAB surface, dark-mode deep-green active surface, and shadowless dark-mode tuning, plus metadata/settings/runtime contracts. |
| builtin-event-core/ | Built-in domain plugin | Core calendar/course/todo tab suite and shared schedule logic. |
| builtin-event-core/INDEX.md | Plugin architecture index | File map for event-core plugin entries, shared domain primitives, scoped refresh payloads, retrying todo sync, and tab/widget runtime responsibilities. |
| builtin-settings/ | Built-in tab plugin | Default settings tab plugin implementation and settings entry. |
| builtin-settings/INDEX.md | Plugin architecture index | File map for the built-in Settings tab runtime and its dynamic sticky-title offset behavior. |
| counter/ | Widget plugin | Numeric counter widget with inline controls and per-instance settings. |
| counter/INDEX.md | Plugin architecture index | File map for counter plugin runtime, metadata, settings, bound validation, and design notes. |
| course-list/ | Widget plugin | Course list widget with plugin-level management settings panel. |
| course-list/INDEX.md | Plugin architecture index | File map for course-list plugin runtime, metadata, global settings, explicit async loading/error feedback, and guarded course-manager entry behavior. |
| grade-calculator/ | Widget plugin | Grade calculator widget with sortable assessment rows and GPA scoring helpers. |
| grade-calculator/INDEX.md | Plugin architecture index | File map for the grade-calculator runtime, metadata, and sortable table behavior. |
| habit-streak/ | Widget plugin | Habit streak dual-widget plugin with per-instance streak data, split Duolingo/ring widget definitions, mode-specific settings, reward bursts, and tests. |
| habit-streak/INDEX.md | Plugin architecture index | File map for habit-streak per-instance state helpers, split widget files, same-day-safe streak handling, accessible action labels, reduced-motion wiring, and burst animation behavior. |
| pomodoro/ | Widget plugin | Pomodoro focus timer widget with session transitions and tests. |
| sticky-note/ | Widget plugin | Sticky note widget with editable content and header actions. |
| tab-template/ | Template plugin | Starter template showing tab plugin structure and contracts. |
| world-clock/ | Widget plugin | Timezone clock widget with display preferences and settings UI. |
| world-clock/INDEX.md | Plugin architecture index | File map for world-clock runtime, settings, locale-aware formatting, and cadence behavior. |
