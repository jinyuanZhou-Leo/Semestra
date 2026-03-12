<!-- ⚠️ Once this folder changes, update me. -->

`sources/` holds built-in Calendar source adapters and the registration bridge.
Each source loads one domain slice and translates it into standalone calendar-core events.
The registration module wires schedule, todo, and gradebook due-date sources into the global Calendar registry without touching plugin contracts.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for built-in Calendar source adapters and registration wiring. |
| gradebookSource.test.ts | Test file | Verifies due-date-only gradebook assessment mapping and targeted Calendar refresh behavior. |
| gradebookSource.ts | Gradebook source | Loads course gradebook assessments with due dates and maps them into all-day Calendar events. |
| registerBuiltinCalendarSources.ts | Registration bridge | Safely registers built-in Calendar sources into the standalone registry. |
| scheduleSource.ts | Schedule source | Loads semester schedule data and maps it to Calendar events with edit support. |
| todoSource.ts | Todo source | Loads semester-synchronized todo items, carries persisted course-color snapshots into todo normalization, and maps them to Calendar events without duplicating mirrored course entries. |
