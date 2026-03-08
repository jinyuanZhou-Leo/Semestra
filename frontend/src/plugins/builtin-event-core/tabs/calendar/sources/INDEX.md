<!-- ⚠️ Once this folder changes, update me. -->

`sources/` holds built-in Calendar source adapters and the registration bridge.
Each source loads one domain slice and translates it into standalone calendar-core events.
The registration module wires those sources into the global Calendar registry without touching plugin contracts.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for built-in Calendar source adapters and registration wiring. |
| registerBuiltinCalendarSources.ts | Registration bridge | Safely registers built-in Calendar sources into the standalone registry. |
| scheduleSource.ts | Schedule source | Loads semester schedule data and maps it to Calendar events with edit support. |
| todoSource.ts | Todo source | Loads course and semester todo items and maps them to Calendar events. |
