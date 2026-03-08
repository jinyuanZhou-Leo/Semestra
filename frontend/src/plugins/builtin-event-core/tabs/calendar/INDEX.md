<!-- ⚠️ Once this folder changes, update me. -->

`tabs/calendar/` implements the built-in Calendar runtime, settings, export flow, and extension wiring.
The folder now centers on a source-driven Calendar shell that consumes the standalone `calendar-core` registry instead of hardcoding schedule/todo loading into one component.
Hooks and source adapters isolate semester context, navigation, editing, and per-source refresh rules so future modules can add Calendar events with lower coupling.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for calendar tab files and responsibilities. |
| CalendarSettings.tsx | Legacy settings dialog | Dialog-style Calendar settings UI for direct in-tab configuration using dynamic source-color controls. |
| CalendarSettings.test.tsx | Test file | Verifies draft-friendly calendar time inputs plus Reading Week week-number toggle behavior. |
| CalendarSettingsSection.tsx | Active settings section | Settings-page Calendar controls including time window, toggles, Reading Week numbering, dynamic source colors, export, and reset actions. |
| CalendarTab.test.tsx | Test file | Verifies CalendarTab can render events from independently registered Calendar sources. |
| CalendarTab.tsx | Main runtime | Source-driven Calendar shell that composes standalone registry data, semester context, navigation, editing, and viewport sizing. |
| CalendarToolbar.tsx | Toolbar UI | Period navigation and view mode controls for week/month calendar surfaces with Reading Week-aware week labels. |
| EventEditor.tsx | Event editor | Per-event skip editing modal with source badges, occurrence-scoped conflict details, and save flow wiring. |
| FullCalendarView.test.tsx | Test file | Verifies FullCalendar-backed month overflow reveal, recurring affordances, tokenized conflict styling, and event click wiring. |
| FullCalendarView.tsx | Calendar renderer | FullCalendar adapter that maps event-core state into week/month views with recurring icons, compact event-type chips, conflict-aware lane splitting, lighter unwrapped today indicators, a circular month-day badge, shadcn-aligned subtly rounded card styling with slim accent rails, explicit clickable hover/active cues, all-day todo rows, full-width single-event lanes, overflow-to-week transitions, and remount-based view/date sync. |
| SemesterScheduleExportModal.tsx | Export workflow | Schedule export modal with PNG/PDF/ICS generation helpers and filters. |
| components/ | Local subcomponents | Calendar-specific presentational helpers such as skeletons and source-color inputs. |
| components/INDEX.md | Components architecture index | File map for Calendar-only visual helpers. |
| hooks/ | Runtime hooks | Source orchestration, semester context, navigation, edit-flow, and sizing hooks used by `CalendarTab`. |
| hooks/INDEX.md | Hooks architecture index | File map for Calendar runtime hook boundaries. |
| index.ts | Calendar entry | Lazy-load entrypoint exports for calendar tab runtime/settings bindings. |
| settings.ts | Settings utilities | Calendar defaults plus normalization/time conversion helpers and dynamic source-color defaults. |
| sources/ | Built-in source adapters | Registry-backed schedule/todo source definitions and registration wiring for Calendar. |
| sources/INDEX.md | Source architecture index | File map for built-in Calendar source adapters and registration glue. |
