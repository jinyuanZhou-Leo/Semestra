<!-- ⚠️ Once this folder changes, update me. -->

`todo/` implements the built-in Todo tab for course and semester contexts.
It orchestrates list selection, task CRUD/reorder, behavior preferences, and scoped persistence.
The UI is responsive, with mobile-first stacking, width-balanced spacing, zero section indent on mobile title/task rows, and touch-friendly actions.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the todo tab module and its main responsibilities. |
| TodoTab.tsx | Runtime entry | Main container that composes sidebar/header/sections and wires state mutations. |
| TodoSettingsSection.tsx | Settings panel | Todo behavior settings UI exposed in tab settings. |
| components/ | UI components | Sidebar/header/task/section rendering and dialog composition for todo flows. |
| hooks/ | State hooks | Local hooks for list modeling, drag/drop behavior, and section open state. |
| preferences.ts | Settings helpers | Normalization and patch helpers for todo behavior settings. |
| shared.ts | Shared constants | Module-level constants and option lists used by runtime and dialogs. |
| types.ts | Domain types | Type models for todo lists, sections, tasks, and sorting behavior. |
| utils/ | Data utilities | Serialization, normalization, and todo mutation helper utilities. |
| index.ts | Public export | Re-exports todo runtime/settings entrypoints for tab registration. |
