<!-- ⚠️ Once this folder changes, update me. -->

`hooks/` contains local state helpers for the Todo tab runtime.
These hooks now split display bucketing for active/completed tasks from persisted open-state and drag-state coordination.
They keep TodoTab orchestration readable while preserving semester/course behavior consistency.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo tab interaction hooks. |
| useTodoSectionOpenMap.ts | Section visibility state | Tracks per-list open/closed state for user sections across semester and course views through plugin UI state. |
| useTodoSectionTasks.ts | Display bucketing | Separates active vs completed tasks per bucket and derives render-ready visible rows that honor the current local sort choice while keeping hidden completed items restorable for a short delay. |
| useTodoTaskDrag.ts | Drag interaction state | Tracks active drag handles, section highlights, and drop indicators for native no-extra-library task reassignment between todo sections. |
| useTodoViewPreferences.ts | Local view preferences | Persists per-semester or per-course sort choices through plugin UI state so returning to a todo list restores the same page state without introducing another plugin-local storage path. |
