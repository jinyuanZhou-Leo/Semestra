<!-- ⚠️ Once this folder changes, update me. -->

Habit-streak plugin now exposes two independent widgets, one Duolingo board and one Ring view, that share the same streak/check-in state inside a semester or course context.
`metadata.ts` is eagerly loaded for the plugin catalog while `index.ts` lazily exposes both runtime widget definitions.
`widget.tsx` owns the shared streak store, sibling-widget sync, mode-specific settings, and shared check-in orchestration.
`HabitStreakCalendar.tsx` and `HabitStreakRing.tsx` own the two UI surfaces separately.
`visuals.tsx` centralizes burst helpers so both widgets can share milestone feedback without re-coupling their layouts.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for habit-streak plugin files and responsibilities. |
| HabitStreakCalendar.tsx | Display component | Duolingo-style calendar board with cell-targeted check-in feedback and milestone overlays. |
| HabitStreakRing.tsx | Display component | Classic ring view with orbit animation, burst overlays, and centered streak readout. |
| metadata.ts | Plugin metadata | Declares plugin id plus separate Duolingo and Ring widget catalog entries for add-widget discovery. |
| index.ts | Runtime entry | Exports both habit-streak widget definitions for plugin loader wiring. |
| visuals.tsx | Visual helpers | Shared burst-state hook plus particle and milestone feedback primitives reused by both display modes. |
| widget.tsx | Widget runtime | Implements streak window helpers, shared semester/course streak store, sibling widget sync, mode-specific settings panels, ring-only motivational toast gating, single-shell widget chrome, and reset behavior via headerButtons. |
| widget.test.tsx | Test suite | Covers helper math, shared-state normalization, dual widget rendering, sibling streak sync, mode-specific settings surfaces, single-shell chrome, and header reset behavior. |
