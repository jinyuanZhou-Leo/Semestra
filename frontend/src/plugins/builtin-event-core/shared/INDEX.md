<!-- ⚠️ Once this folder changes, update me. -->

`shared/` contains cross-tab schedule primitives reused by calendar, course-schedule, todo, and widget surfaces.
It centralizes constants, event-bus contracts, typed payloads, and cache-aware schedule helpers.
This layer now carries semester-scoped refresh metadata so cross-context updates stay precise.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for shared event-core data and event primitives. |
| constants.ts | Shared constants | Built-in tab/widget ids plus schedule/calendar cache and rendering constants. |
| eventBus.ts | Event bus | Lightweight timetable event bus used to fan out scoped schedule mutations. |
| hooks/ | Shared hooks | Event-core hooks including cached schedule loading helpers. |
| types.ts | Shared types | Schedule/event payload types shared across tabs, widget, and settings surfaces. |
| utils.ts | Shared utilities | Date/time conversion, schedule grouping, filtering, and calendar event mappers. |
