<!-- ⚠️ Once this folder changes, update me. -->

`tabs/` contains the feature modules rendered as built-in event-core tabs.
Each tab folder owns its runtime UI and settings behavior while sharing domain contracts from `../shared`.
This layer keeps tab concerns isolated (calendar, course schedule, todo) for maintainable iteration.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for event-core tab module folders. |
| calendar/ | Calendar tab module | Week/month views, toolbar/editor flows, calendar settings, and export actions. |
| course-schedule/ | Course schedule tab module | Course timetable rendering and schedule-specific settings/actions. |
| todo/ | Todo tab module | Responsive task board/list management UI with mobile-first stacking, preferences, and task dialog flows. |
