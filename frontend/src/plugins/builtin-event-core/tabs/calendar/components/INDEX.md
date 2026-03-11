<!-- ⚠️ Once this folder changes, update me. -->

`components/` contains small Calendar-only presentation helpers.
These files stay UI-focused so orchestration can live in hooks and source adapters.
The folder isolates settings controls and loading placeholders from the Calendar shell.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for Calendar-only presentational helpers. |
| CalendarAllDayEventContent.tsx | Event UI | All-day event renderer that handles month pills, week all-day rows, and todo-style completion radios. |
| CalendarSkeleton.tsx | Loading UI | Compact toolbar-and-grid placeholder used while Calendar runtime state is still loading. |
| CalendarEventContent.tsx | Event UI | Shared layout selector that computes event display state and delegates to all-day or standard event renderers, including todo completion callbacks. |
| CalendarStandardEventContent.tsx | Event UI | Standard timed-event renderer that handles month chips and week-detail cards. |
| EventColorPicker.tsx | Settings field | Source-aware color picker row for dynamic Calendar source color settings. |
