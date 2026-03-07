<!-- ⚠️ Once this folder changes, update me. -->

`components/` contains reusable event-core dialogs and shared schedule presentation helpers.
These files are consumed across course-schedule and calendar flows to keep editing and conflict rendering consistent.
The weekly calendar helper now surfaces conflict state alongside skip/normal event tones.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for shared event-core dialogs and presentation helpers. |
| CrudPanel.tsx | Shared CRUD shell | Reusable panel/table wrappers for event-core management surfaces. |
| EventTypeFormDialog.tsx | Event-type dialog | Create/edit dialog for course event types. |
| SectionFormDialog.tsx | Section dialog | Create/edit dialog for section slots and generated events. |
| WeeklyCalendarView.tsx | Schedule renderer | Shared weekly schedule grid with skip/conflict-aware event styling and clearer conflict affordances. |
