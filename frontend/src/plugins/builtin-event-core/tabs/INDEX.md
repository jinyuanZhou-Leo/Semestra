<!-- ⚠️ Once this folder changes, update me. -->

`tabs/` contains the feature modules rendered as built-in event-core tabs.
Each tab folder owns its runtime UI and settings behavior while sharing domain contracts from `../shared`.
This layer keeps tab concerns isolated (calendar, course schedule, todo) while the Calendar module now consumes standalone registry-backed sources, including LMS events, plus configurable week-view scroll width instead of hardwiring all event types into one component.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for event-core tab module folders. |
| calendar/ | Calendar tab module | FullCalendar-backed week/month views, configurable week-view horizontal scroll width, standalone registry-backed source orchestration including LMS events, Reading Week-aware week numbering and event suppression, toolbar/editor flows, settings, export actions, and month overflow reveal affordances. |
| course-schedule/INDEX.md | Course schedule module architecture index | File map for section management, event-type settings, and keyboard-accessible section expansion. |
| course-schedule/ | Course schedule tab module | Course timetable rendering with keyboard-accessible section expansion, atomic section toggles, and schedule-specific settings/actions. |
| todo/ | Todo tab module | Semester-first Apple Reminder-style aggregate todo UI with section-scoped compact inline create, inline title/tag editing, completed-summary controls, mirrored course sync, and safer destructive flows. |
