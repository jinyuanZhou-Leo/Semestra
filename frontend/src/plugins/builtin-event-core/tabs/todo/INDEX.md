<!-- ⚠️ Once this folder changes, update me. -->

`todo/` implements the built-in Todo tab for course and semester contexts.
It now orchestrates a semester-first aggregate todo view, mirrored course sync, behavior preferences, calendar refresh notifications for dated todo changes, and external Calendar-originated todo sync.
The UI is responsive, Apple Reminder-inspired, supports inline tag-based quick create, and keeps course views filtered without exposing manual section management there.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the todo tab module and its main responsibilities. |
| TodoTab.tsx | Runtime entry | Main container that loads semester aggregate todo state, mirrors course snapshots, drives task/section mutations, applies external Calendar-originated todo sync, and renders the aggregate list UI. |
| TodoSettingsSection.tsx | Settings panel | Todo behavior settings UI exposed in tab settings. |
| components/ | UI components | Aggregate header/task/section rendering, inline quick create, and dialog composition for todo flows. |
| hooks/ | State hooks | Local hooks for drag/drop behavior and section open state. |
| preferences.ts | Settings helpers | Normalization and patch helpers for todo behavior settings. |
| shared.ts | Shared constants | Module-level constants and option lists used by runtime, migration, and dialogs. |
| types.ts | Domain types | Type models for semester aggregate tasks, mirrored course views, sections, and sorting behavior. |
| utils/ | Data utilities | Synchronization, migration, serialization, calendar sync, and shared todo mutation helper utilities. |
| index.ts | Public export | Re-exports todo runtime/settings entrypoints for tab registration. |
