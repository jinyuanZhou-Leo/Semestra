<!-- ⚠️ Once this folder changes, update me. -->

`components/` contains the visual building blocks for the Todo tab runtime.
These components now render an Apple Reminder-style aggregate list with inline quick-create tags, shared section blocks, and course-colored task rows.
Dialogs are grouped under `dialogs/` while cards/headers/sections stay in this folder.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo tab presentation components. |
| TodoInlineCreateRow.tsx | Inline composer | Renders the bottom dashed-radio quick-create row with inline Date, Time, Priority, and Course tag editing. |
| TodoMainHeader.tsx | Action header | Renders aggregate title, sort controls, and semester/course add actions without legacy list controls. |
| TodoTaskCard.tsx | Task card item | Displays Reminder-style task rows with completion control, badges, and course-colored tags. |
| TodoSectionBlock.tsx | Section container | Collapsible section wrapper with drag target behavior, no mobile left indent for section title/task rows, and delete-confirmation request wiring. |
| TodoUnsectionedBlock.tsx | Unsectioned bucket | Renders tasks without a section and accepts drop operations. |
| dialogs/ | Dialog components | Modal flows for task edit/create and section rename. |
