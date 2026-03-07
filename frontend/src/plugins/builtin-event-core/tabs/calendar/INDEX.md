<!-- ⚠️ Once this folder changes, update me. -->

`tabs/calendar/` implements the event-core calendar experience and its settings/export flows.
It combines lazy-loaded runtime surfaces (tab shell, full view, editor) with setting normalization helpers, scoped event-bus refresh handling, and conflict summaries.
Supporting components isolate skeletons and visual controls so calendar features evolve without cross-tab coupling or duplicate reloads.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for calendar tab files and responsibilities. |
| CalendarSettings.tsx | Legacy settings dialog | Dialog-style calendar settings UI for direct in-tab configuration. |
| CalendarSettingsSection.tsx | Active settings section | Settings-page calendar controls including time window, toggles, source colors, export, and reset actions. |
| CalendarTab.tsx | Main runtime | Calendar tab state orchestration, scoped data loading, occurrence-scoped conflict grouping, self-publish reload suppression, and view composition including month-to-week reveal handoff. |
| CalendarToolbar.tsx | Toolbar UI | Week navigation and view mode controls for calendar surfaces. |
| EventEditor.tsx | Event editor | Per-event skip/enable editing modal with occurrence-scoped conflict details and save flow wiring. |
| FullCalendarView.test.tsx | Test file | Verifies month-view overflow reveal actions plus week-view conflict layout affordances. |
| FullCalendarView.tsx | Calendar renderer | Week/month rendering logic with conflict highlighting, side-by-side overlap layout, conflict labels, day/time grid layout, and overflow day reveal actions in month view. |
| SemesterScheduleExportModal.tsx | Export workflow | Schedule export modal with PNG/PDF/ICS generation helpers and filters. |
| components/ | Local subcomponents | Calendar-specific shared UI pieces (skeletons, color picker). |
| index.ts | Calendar entry | Lazy-load entrypoint exports for calendar tab runtime/settings bindings. |
| settings.ts | Settings utilities | Calendar defaults plus normalization/time conversion helpers. |
