<!-- ⚠️ Once this folder changes, update me. -->

`hooks/` contains local state helpers for the Todo tab runtime.
These hooks now split display bucketing for active/completed tasks from open-state and drag-state coordination.
They keep TodoTab orchestration readable while preserving semester/course behavior consistency.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo tab interaction hooks. |
| useTodoSectionOpenMap.ts | Section visibility state | Tracks per-list open/closed state for user sections across semester and course views. |
| useTodoSectionTasks.ts | Display bucketing | Separates active vs completed tasks per bucket and derives original-order visible rows so hidden completed tasks can disappear after a short in-place delay. |
| useTodoTaskDrag.ts | Drag interaction state | Tracks active drag handles, section highlights, and row-level drop indicators for native no-extra-library reordering. |
