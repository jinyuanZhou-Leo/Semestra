<!-- ⚠️ Once this folder changes, update me. -->

`todo/` implements the built-in Todo tab for course and semester contexts.
It now orchestrates a semester-first aggregate todo view backed by the dedicated semester todo API and shared semester todo query cache instead of `tab.settings`, with local-only sorting persisted per list in browser storage, note-based task details, inline editing, and keyboard-safe destructive flows.
The UI stays Apple Reminder-inspired while keeping course views filtered, preserving semester-as-source semantics, and rebuilding view state locally from canonical todo data after Calendar-originated updates.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the todo tab module and its main responsibilities. |
| TodoTab.tsx | Runtime entry | Main container that hydrates from shared semester todo query state, restores local per-list sorting preferences, drives task/section mutations through dedicated endpoints, rebuilds local list state from canonical cache after Calendar-originated todo updates, and lets each inline composer own its local draft while the tab only handles persistence. |
| TodoTab.test.tsx | Interaction tests | Covers per-composer inline draft isolation, canonical-to-UI todo derivation, stable compact inline create shell reuse, blur-triggered quick-create commits, compact time-chip editing alignment, local sort bucketing, and persisted view-preference restoration. |
| TodoSettingsSection.tsx | Settings panel | Todo behavior settings UI exposed in tab settings, now using a shadcn `Field`-based switch row with the control aligned on the right for hidden completed-bucket storage behavior. |
| components/ | UI components | Aggregate header/task/section rendering, compact section composers with blur-to-save quick creation, completed summary, inline meta-chip editing, and dialog composition for todo flows. |
| hooks/ | State hooks | Local hooks for drag/drop state, section open state, and completed-aware display bucketing. |
| hooks/INDEX.md | Hooks architecture index | File-level map for todo interaction hooks. |
| preferences.ts | Settings helpers | Normalization and patch helpers for todo behavior settings. |
| shared.ts | Shared constants | Module-level constants and option lists used by runtime, migration, and dialogs. |
| types.ts | Domain types | Type models for semester aggregate tasks, note fields, course-filtered views, sections, and local sorting behavior. |
| utils/ | Data utilities | API-to-runtime mapping, calendar sync helpers, legacy parsing fallback, and shared todo mutation helper utilities. |
| index.ts | Public export | Re-exports todo runtime/settings entrypoints for tab registration. |
