<!-- ⚠️ Once this folder changes, update me. -->

`tabs/calendar/` implements the event-core calendar experience and its settings/export flows.
It combines lazy-loaded runtime surfaces (tab shell, FullCalendar adapter, editor) with setting normalization helpers, scoped event-bus refresh handling, occurrence-scoped conflict handling, semester/course todo aggregation, and Reading Week-aware week numbering.
Supporting components isolate skeletons and visual controls so the FullCalendar surface can stay scroll-first on tight layouts, keep month/week navigation aligned, use shadcn-like tokenized conflict styling, emphasize today through lighter unwrapped header cues and a true circular month-day badge, and show recurring/status affordances with slimmer accent rails, subtly rounded event cards, compact chips/icons, explicit clickable hover/active feedback, full-width single-event lanes, all-day todo rows, dark-mode-aware scrollbars, matched shell/scrollgrid radii, and todo-driven live refresh without top conflict badges.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for calendar tab files and responsibilities. |
| CalendarSettings.tsx | Legacy settings dialog | Dialog-style calendar settings UI for direct in-tab configuration, including the Reading Week week-number toggle. |
| CalendarSettings.test.tsx | Test file | Verifies draft-friendly calendar time inputs plus Reading Week week-number toggle behavior. |
| CalendarSettingsSection.tsx | Active settings section | Settings-page calendar controls including time window, toggles, Reading Week numbering, source colors, export, and reset actions. |
| CalendarTab.tsx | Main runtime | Calendar tab state orchestration, scoped data loading, Reading Week event suppression, shifted week-number labeling, todo aggregation with course-detail fallback, live refresh, and month/week-aware navigation with scroll-friendly viewport sizing. |
| CalendarToolbar.tsx | Toolbar UI | Period navigation and view mode controls for week/month calendar surfaces with Reading Week-aware week labels. |
| EventEditor.tsx | Event editor | Per-event skip/enable editing modal with occurrence-scoped conflict details and save flow wiring. |
| FullCalendarView.test.tsx | Test file | Verifies FullCalendar-backed month overflow reveal, recurring affordances, tokenized conflict styling, and event click wiring. |
| FullCalendarView.tsx | Calendar renderer | FullCalendar adapter that maps event-core state into week/month views with recurring icons, compact event-type chips, conflict-aware lane splitting, lighter unwrapped today indicators, a circular month-day badge, shadcn-aligned subtly rounded card styling with slim accent rails, explicit clickable hover/active cues, all-day todo rows, full-width single-event lanes, overflow-to-week transitions, and remount-based view/date sync. |
| SemesterScheduleExportModal.tsx | Export workflow | Schedule export modal with PNG/PDF/ICS generation helpers and filters. |
| components/ | Local subcomponents | Calendar-specific shared UI pieces (skeletons, color picker). |
| index.ts | Calendar entry | Lazy-load entrypoint exports for calendar tab runtime/settings bindings. |
| settings.ts | Settings utilities | Calendar defaults plus normalization/time conversion helpers, including the default-off Reading Week week-number flag. |
