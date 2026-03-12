<!-- ⚠️ Once this folder changes, update me. -->

`components/` contains the visual building blocks for the Todo tab runtime.
These components now render an Apple Reminder-style aggregate list with compact section composers, completed-summary controls, inline meta-chip editing, and row-level swipe/delete affordances.
Dialogs remain grouped under `dialogs/` while list/header/meta-chip primitives stay in this folder.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo tab presentation components. |
| TodoCompletedSummary.tsx | Completed summary strip | Renders the Apple Reminders-style `X Completed / Clear / Show-Hide` control without a dedicated completed section. |
| TodoInlineCreateRow.tsx | Inline composer | Renders the compact section-scoped quick-create row in the same aligned visual rhythm as task rows, with blur-cancel behavior that keeps Select and Popover chip editors open instead of collapsing the draft. |
| TodoMainHeader.tsx | Action header | Renders aggregate title, sort controls, and semester/course add actions without legacy list controls. |
| TodoMetaEditorChips.tsx | Meta chip editor | Reusable inline date, time, priority, and course chip editors with overdue emphasis, tighter in-chip clear actions, and stable distinct course coloring shared by create and quick-edit flows. |
| TodoTaskCard.tsx | Task card item | Displays flatter Apple Reminders-style task rows with focus-driven single-task edit mode, persistent title/notes inputs, compact collapsed metadata including distinct course pills, animated fill-only completion radios, snap-open notes/meta editors without expand-height animation, swipe-to-delete reveal, and drag handles. |
| TodoSectionBlock.tsx | Section container | Collapsible section wrapper with inline title editing, drag targets, original-order visible task rendering, and section-scoped composer placement. |
| TodoUnsectionedBlock.tsx | Unsectioned bucket | Renders tasks without a section, keeps just-completed rows visible in place before hide, and accepts drop operations. |
| dialogs/ | Dialog components | Modal flows for explicit full-detail task editing. |
