<!-- ⚠️ Once this folder changes, update me. -->

`tabs/calendar/` implements the built-in Calendar runtime, settings, export flow, and extension wiring.
The folder now centers on a source-driven Calendar shell that consumes the standalone `calendar-core` registry instead of hardcoding schedule/todo/gradebook loading into one component.
Hooks and source adapters isolate semester context, navigation, editing, per-source refresh rules, and Query-cache-aware remount reuse so future modules can add Calendar events, including LMS events, with lower coupling while preserving the existing grid during event refreshes.
The Calendar tab now derives a buffered query window from the active week/month view so schedule and LMS sources load only nearby dates instead of fan-out fetching an entire semester, and it prefetches adjacent view windows for smoother week-to-week navigation.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for calendar tab files and responsibilities. |
| CalendarSettings.tsx | Legacy settings dialog | Dialog-style Calendar settings UI for direct in-tab configuration using draft-friendly time inputs, dynamic source-color controls, and week-view day-count selection. |
| CalendarSettings.test.tsx | Test file | Verifies draft-friendly calendar time inputs plus Reading Week toggles and week-view day-count selection behavior. |
| CalendarSettingsSection.tsx | Active settings section | Settings-page Calendar controls including shadcn `Field`-based standard form layout, right-aligned toggle rows, draft-friendly time-window inputs, week-view screen width, Reading Week numbering, dynamic source colors, export, and reset actions. |
| CalendarTab.test.tsx | Test file | Verifies CalendarTab can render events from independently registered Calendar sources. |
| CalendarTab.tsx | Main runtime | Source-driven Calendar shell that composes standalone registry data, semester context, buffered query ranges, configurable week-view scroll width, editing, todo completion sync, viewport sizing, a manual refresh action, and targeted external refresh signals such as gradebook due-date changes. |
| CalendarToolbar.test.tsx | Test file | Verifies the Calendar header renders a compact, stable single-shell right-side summary block for week and Reading Week states. |
| CalendarToolbar.tsx | Toolbar UI | Period navigation, manual refresh, and view mode controls for week/month calendar surfaces with unified toolbar chrome and a compact single-shell Reading Week-aware summary block on the right. |
| EventEditor.tsx | Event editor | Per-event detail dialog with source badges, wrapperless event metadata, occurrence-scoped conflict details, LMS/read-only detail mode, safe HTML description rendering with limited inline-style preservation, and skip-save wiring for editable schedule events. |
| FullCalendarView.test.tsx | Test file | Verifies FullCalendar-backed month overflow reveal, all-day todo completion radios, Apple Calendar-style title/location/time hierarchy, DST-safe week syncing, recurring affordances, configurable week-view scroll width, `x more` month overflow labels, and event click wiring. |
| FullCalendarView.tsx | Calendar renderer | FullCalendar adapter that maps event-core state into week/month views with configurable week-view horizontal scroll width, Apple Calendar-style single-line week headers, named all-day and standard event-content subcomponents that each handle their own month/week variants, all-day todo completion radios that sync back to Todo, compact trailing month time labels, `x more` month overflow labels, a screenshot-style labeled current-time indicator, matched red today badges across month and week headers, recurring icons, conflict-aware lane splitting, lighter borderless event surfaces with spaced parallel lanes, overflow-to-week transitions, and remount-based view/date sync backed by DST-safe academic week math. |
| SemesterScheduleExportModal.tsx | Export workflow | Schedule export modal with PNG/PDF/ICS generation helpers and filters. |
| components/ | Local subcomponents | Calendar-specific presentational helpers such as shared event-content rendering, a pure-Skeleton height-matched loading shell, and source-color inputs. |
| components/INDEX.md | Components architecture index | File map for Calendar-only visual helpers. |
| hooks/ | Runtime hooks | Source orchestration, shared-cache semester context, academic week navigation with buffered query-range output, edit-flow, and sizing hooks used by `CalendarTab`. |
| hooks/INDEX.md | Hooks architecture index | File map for Calendar runtime hook boundaries. |
| index.ts | Calendar entry | Lazy-load entrypoint exports for calendar tab runtime/settings bindings. |
| settings.ts | Settings utilities | Calendar defaults plus normalization/time conversion helpers, week-view screen-width settings, and dynamic source-color defaults. |
| sources/ | Built-in source adapters | Registry-backed schedule, todo, gradebook, and LMS source definitions with Query-cache reuse, buffered range fetching where supported, and registration wiring for Calendar. |
| sources/INDEX.md | Source architecture index | File map for built-in Calendar source adapters and registration glue. |
