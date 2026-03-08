<!-- ⚠️ Once this folder changes, update me. -->

`components/` contains small Calendar-only presentation helpers.
These files stay UI-focused so orchestration can live in hooks and source adapters.
The folder isolates settings controls and loading placeholders from the Calendar shell.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for Calendar-only presentational helpers. |
| CalendarSkeleton.tsx | Loading UI | Placeholder shell used while Calendar runtime state is still loading. |
| EventColorPicker.tsx | Settings field | Source-aware color picker row for dynamic Calendar source color settings. |
