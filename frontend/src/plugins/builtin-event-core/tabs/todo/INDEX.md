<!-- ⚠️ Once this folder changes, update me. -->

`todo/` implements the built-in Todo tab for course and semester contexts.
It now orchestrates a semester-first aggregate todo view with section-scoped inline creation, persistent inline title editing, three-line collapsed task previews, inline tag editors, stable distinct course colors, animated fill-only completion radios, delayed-hide completed rendering that preserves original row order, mirrored course sync, and keyboard-safe destructive flows.
The UI stays Apple Reminder-inspired while keeping course views filtered and preserving semester/course persistence semantics.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the todo tab module and its main responsibilities. |
| TodoTab.tsx | Runtime entry | Main container that loads semester aggregate todo state, mirrors course snapshots, drives task/section mutations, applies external Calendar-originated todo sync, and renders completed-summary plus inline-edit/list interaction flows. |
| TodoTab.test.tsx | Interaction tests | Covers compact inline create behavior and completed-task bucketing rules. |
| TodoSettingsSection.tsx | Settings panel | Todo behavior settings UI exposed in tab settings, including hidden completed-bucket storage behavior. |
| components/ | UI components | Aggregate header/task/section rendering, compact section composers, completed summary, inline meta-chip editing, and dialog composition for todo flows. |
| hooks/ | State hooks | Local hooks for drag/drop state, section open state, and completed-aware display bucketing. |
| hooks/INDEX.md | Hooks architecture index | File-level map for todo interaction hooks. |
| preferences.ts | Settings helpers | Normalization and patch helpers for todo behavior settings. |
| shared.ts | Shared constants | Module-level constants and option lists used by runtime, migration, and dialogs. |
| types.ts | Domain types | Type models for semester aggregate tasks, mirrored course views, sections, and sorting behavior. |
| utils/ | Data utilities | Synchronization, migration, serialization, calendar sync, and shared todo mutation helper utilities. |
| index.ts | Public export | Re-exports todo runtime/settings entrypoints for tab registration. |
