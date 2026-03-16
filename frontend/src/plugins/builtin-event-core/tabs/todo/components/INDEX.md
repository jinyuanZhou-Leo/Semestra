<!-- ⚠️ Once this folder changes, update me. -->

`components/` contains the visual building blocks for the Todo tab runtime.
These components now render an Apple Reminder-style aggregate list with compact section composers, completed-summary controls, inline meta-chip editing, and row-level swipe/delete affordances.
Dialogs remain grouped under `dialogs/` while list/header/meta-chip primitives stay in this folder.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo tab presentation components. |
| TodoCompletedSummary.tsx | Completed summary strip | Renders the Apple Reminders-style `X Completed / Clear / Show-Hide` control without a dedicated completed section. |
| TodoInlineCreateRow.tsx | Inline composer | Renders the compact section-scoped quick-create row on the shared todo row shell, keeps each composer draft local to its own instance, opens the title field in place without a disappear/reappear remount, and auto-creates on blur when the draft already has a title. |
| TodoMainHeader.tsx | Action header | Renders aggregate title, sort controls, and semester/course add actions without legacy list controls. |
| TodoMetaEditorChips.tsx | Meta chip editor | Reusable inline date, time, priority, and course chip editors with overdue emphasis, tighter in-chip clear actions, stable distinct course coloring, and compact time-edit alignment shared by create and quick-edit flows. |
| TodoRowShell.tsx | Shared row shell | Exports the shared `placeholder / creating / view / editing` row scaffold and typography tokens reused by inline create and task rows so they keep one alignment contract. |
| TodoTaskCard.tsx | Task card item | Displays flatter Apple Reminders-style task rows with focus-driven single-task edit mode, the shared row shell and typography contract, compact collapsed metadata including distinct course pills, animated fill-only completion radios, snap-open notes/meta editors without expand-height animation, empty-title direct deletion without confirmation, swipe-to-delete reveal, and drag handles. |
| TodoSectionBlock.tsx | Section container | Collapsible section wrapper with inline title editing, drag targets, original-order visible task rendering, and section-scoped composer placement. |
| TodoUnsectionedBlock.tsx | Unsectioned bucket | Renders tasks without a section, keeps just-completed rows visible in place before hide, and accepts drop operations. |
| dialogs/ | Dialog components | Modal flows for explicit full-detail task editing. |
