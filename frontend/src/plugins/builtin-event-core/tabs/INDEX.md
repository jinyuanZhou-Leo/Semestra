<!-- ⚠️ Once this folder changes, update me. -->

`tabs/` contains the feature modules rendered as built-in event-core tabs.
Each tab folder owns its runtime UI and settings behavior while sharing domain contracts from `../shared`.
This layer keeps tab concerns isolated (calendar, course schedule, todo) while allowing scoped schedule refreshes and targeted persistence fixes per tab.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for event-core tab module folders. |
| calendar/ | Calendar tab module | Week/month views, toolbar/editor flows, scoped reload handling, calendar settings, export actions, and month overflow reveal affordances. |
| course-schedule/INDEX.md | Course schedule module architecture index | File map for section management, event-type settings, and keyboard-accessible section expansion. |
| course-schedule/ | Course schedule tab module | Course timetable rendering with keyboard-accessible section expansion, atomic section toggles, and schedule-specific settings/actions. |
| todo/ | Todo tab module | Responsive task board/list management UI with mobile-first stacking, preferences, retrying semester sync, task dialog flows, and safer section deletion. |
