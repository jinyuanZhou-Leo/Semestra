<!-- ⚠️ Once this folder changes, update me. -->

`course-schedule/` implements the per-course section management surface for event-core.
It combines list rendering, section CRUD, event-type creation, semester-scoped refresh payloads, and event enable/disable controls.
The tab now exposes explicit keyboard-accessible expand controls, atomic batch toggles for section details, a dedicated Location column in the section list, and theme-safe native slot time pickers in the shared section dialog.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the course-schedule tab files and responsibilities. |
| CourseScheduleTab.tsx | Main runtime | Renders the section table with explicit location summaries, accessible expand controls, atomic section toggles, and section deletion flows. |
| CourseScheduleSettings.tsx | Settings panel | Manages course event types for the course-schedule tab settings surface with a tighter mobile CRUD table and publishes semester-scoped refresh events. |
| index.ts | Public export | Re-exports course-schedule runtime/settings entrypoints for tab registration. |
