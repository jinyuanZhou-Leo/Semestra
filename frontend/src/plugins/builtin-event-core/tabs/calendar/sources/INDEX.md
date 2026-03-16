<!-- ⚠️ Once this folder changes, update me. -->

`sources/` holds built-in Calendar source adapters and the registration bridge.
Each source now hydrates from shared Query cache first, reloads only on explicit invalidation signals, and translates one domain slice into standalone calendar-core events.
Schedule and LMS sources now key their caches by buffered date windows so the Calendar view fetches only nearby data instead of loading an entire semester up front, and each source prefetches adjacent windows into local cache for smoother navigation.
The registration module wires schedule, todo, gradebook due-date, and LMS semester-event sources into the global Calendar registry without touching plugin contracts.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for built-in Calendar source adapters and registration wiring. |
| gradebookSource.test.ts | Test file | Verifies due-date-only gradebook assessment mapping and targeted Calendar refresh behavior. |
| gradebookSource.ts | Gradebook source | Reuses semester and course gradebook Query caches, serves cached due-date assessments immediately on remount, invalidates only affected gradebook entries on refresh, and maps them into all-day Calendar events. |
| lmsSource.ts | LMS source | Reuses range-scoped semester LMS Calendar queries, serves read-only LMS semester events for the buffered visible window, prefetches adjacent windows into local cache, and maps them into calendar-core event data with local course-code titles plus LMS event-name subtitles and no edit support. |
| registerBuiltinCalendarSources.ts | Registration bridge | Safely registers built-in schedule, todo, gradebook, and LMS Calendar sources into the standalone registry. |
| scheduleSource.ts | Schedule source | Reuses buffered semester calendar schedule window caches for remounts, prefetches adjacent windows into local cache, removes only those snapshots when a real timetable refresh is needed, and maps editable schedule events without week-by-week fan-out requests. |
| todoSource.ts | Todo source | Reuses semester todo Query cache, serves cached todo events immediately on remount, invalidates that cache only when todo-backed Calendar refreshes are required, and avoids any dependency on todo tab instance settings. |
