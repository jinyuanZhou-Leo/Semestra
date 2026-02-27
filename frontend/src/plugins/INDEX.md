<!-- ⚠️ Once this folder changes, update me. -->

`src/plugins/` contains plugin implementations that extend dashboard widgets and homepage tabs.
Each plugin folder provides runtime entrypoints, metadata catalog declarations, and optional settings/test files.
The plugin-system auto-loads `metadata.ts` eagerly and `index.ts` lazily per plugin.

**Conventions:**
- `metadata.ts` is the **single source of truth** for fields like `name`, `description`, `icon`, `layout`, `maxInstances`, and `allowedContexts`.
- Runtime definitions in `widget.tsx`/`tab.tsx` only declare runtime-specific fields: `type`, `component`, `SettingsComponent`, `defaultSettings`, `headerButtons`, `onCreate`, `onDelete`.
- `settings.ts` is **optional** — only include when the plugin defines tab or widget global settings definitions. Plugins without global settings do not need this file.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local plugin folder architecture and plugin catalog map. |
| builtin-dashboard/ | Built-in tab plugin | Default dashboard tab plugin implementation and settings entry. |
| builtin-dashboard/INDEX.md | Plugin architecture index | File map for built-in dashboard tab runtime with light-mode light-green glass active FAB surface, dark-mode deep-green active surface, and shadowless dark-mode tuning, plus metadata/settings exports. |
| builtin-event-core/ | Built-in domain plugin | Core calendar/course/todo tab suite and shared schedule logic. |
| builtin-event-core/INDEX.md | Plugin architecture index | File map for event-core plugin entries, shared domain primitives, tab modules, and widget runtime responsibilities. |
| builtin-settings/ | Built-in tab plugin | Default settings tab plugin implementation and settings entry. |
| counter/ | Widget plugin | Numeric counter widget with inline controls and per-instance settings. |
| counter/INDEX.md | Plugin architecture index | File map for counter plugin runtime, metadata, settings, and design notes. |
| course-list/ | Widget plugin | Course list widget with plugin-level management settings panel. |
| course-list/INDEX.md | Plugin architecture index | File map for course-list plugin runtime, metadata, global settings, and async fetch guards. |
| grade-calculator/ | Widget plugin | Grade calculator widget with scoring helpers and settings model. |
| habit-streak/ | Widget plugin | Habit streak widget with cadence checks, softer light-mode ring track contrast, subtle orbital ring motion, center-text readability tuning, precomputed lower-cost milestone/overachieve burst animation, expanded short interval-agnostic motivation templates, rewards, and tests. |
| habit-streak/INDEX.md | Plugin architecture index | File map for habit-streak helper logic, light/dark ring + typography runtime tuning, subtle ring motion behavior, and precomputed burst animation behavior. |
| pomodoro/ | Widget plugin | Pomodoro focus timer widget with session transitions and tests. |
| sticky-note/ | Widget plugin | Sticky note widget with editable content and header actions. |
| tab-template/ | Template plugin | Starter template showing tab plugin structure and contracts. |
| world-clock/ | Widget plugin | Timezone clock widget with display preferences and settings UI. |
| world-clock/INDEX.md | Plugin architecture index | File map for world-clock runtime, settings, and cadence behavior. |
