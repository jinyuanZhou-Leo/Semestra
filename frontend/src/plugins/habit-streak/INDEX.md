<!-- ⚠️ Once this folder changes, update me. -->

Habit-streak plugin now exposes two independent widgets, one Duolingo board and one Ring view, with per-instance streak/check-in state inside a semester or course context.
`plugin.json` and `plugin.ts` now provide the eager descriptor-backed entry while `index.ts` lazily exposes both runtime widget definitions.
`widget.tsx` owns the per-instance streak store, delete cleanup hook, concise mode-specific settings, same-day-safe check-in orchestration, and accessibility wiring.
`HabitStreakCalendar.tsx` and `HabitStreakRing.tsx` own the two UI surfaces separately.
`visuals.tsx` centralizes burst helpers so both widgets can share milestone feedback without re-coupling their layouts.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for habit-streak plugin files and responsibilities. |
| HabitStreakCalendar.tsx | Display component | Duolingo-style calendar board with cell-targeted check-in feedback and milestone overlays. |
| HabitStreakRing.tsx | Display component | Classic ring view with orbit animation, burst overlays, and centered streak readout. |
| plugin.json | Plugin manifest | Static public manifest for plugin identity plus dual-widget metadata shared with the backend. |
| plugin.ts | Plugin entry | Binds the descriptor to lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Exports both habit-streak widget definitions for plugin loader wiring. |
| visuals.tsx | Visual helpers | Shared burst-state hook plus particle and milestone feedback primitives reused by both display modes. |
| widget.tsx | Widget runtime | Implements streak window helpers, per-instance streak store, delete cleanup via `onDelete`, same-day-safe no-interval streak handling, a reduced-motion hook, habit-specific check-in button labels, ring-only motivational toast gating, single-shell widget chrome, and reset behavior via headerButtons. |
| widget.test.tsx | Test suite | Covers helper math, same-day no-interval streak stability, dual widget rendering, accessible check-in labels, isolated multi-instance behavior, mode-specific settings surfaces, single-shell chrome, and header reset/delete behavior. |
