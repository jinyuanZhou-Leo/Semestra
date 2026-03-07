<!-- ⚠️ Once this folder changes, update me. -->

`shared/` contains cross-tab schedule primitives reused by calendar, course-schedule, todo, and widget surfaces.
It centralizes constants, event-bus contracts, typed payloads, and cache-aware schedule helpers.
This layer now also exposes semester week/date conversion, Reading Week-aware numbering helpers, recurring metadata, and all-day todo event mapping so FullCalendar navigation and event affordances stay in sync across week and month views.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for shared event-core data and event primitives. |
| constants.ts | Shared constants | Built-in tab/widget ids plus schedule/calendar cache and rendering constants. |
| eventBus.ts | Event bus | Lightweight timetable event bus used to fan out scoped schedule mutations. |
| hooks/ | Shared hooks | Event-core hooks including cached schedule loading helpers. |
| utils.test.ts | Test file | Guards timezone-safe semester date parsing, Reading Week range validation, and week-number alignment helpers. |
| types.ts | Shared types | Schedule/event payload types shared across tabs, widget, and settings surfaces, including recurring, all-day calendar metadata, and Reading Week-aware settings state. |
| utils.ts | Shared utilities | Date/time conversion, semester week/date helpers, Reading Week-aware numbering/filtering helpers, recurring-event mapping, schedule grouping, filtering, and calendar/todo event mappers. |
