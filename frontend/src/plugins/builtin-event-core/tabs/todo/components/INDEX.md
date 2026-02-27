<!-- ⚠️ Once this folder changes, update me. -->

`components/` contains the visual building blocks for the Todo tab runtime.
These components render responsive list/task layouts with width-balanced mobile spacing and expose interaction callbacks upward.
Dialogs are grouped under `dialogs/` while cards/headers/sections stay in this folder.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo tab presentation components. |
| TodoListSidebar.tsx | List navigation panel | Selects lists and manages custom list actions with mobile-safe sizing. |
| TodoMainHeader.tsx | Action header | Renders list title, sort controls, and primary add actions. |
| TodoTaskCard.tsx | Task card item | Displays task content, status, badges, and edit/delete controls with mobile width optimization. |
| TodoSectionBlock.tsx | Section container | Collapsible section wrapper with drag target behavior and no mobile left indent for section title/task rows. |
| TodoUnsectionedBlock.tsx | Unsectioned bucket | Renders tasks without a section and accepts drop operations. |
| dialogs/ | Dialog components | Modal flows for task edit/create, list rename/delete, and section rename. |
