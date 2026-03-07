<!-- ⚠️ Once this folder changes, update me. -->

Habit-streak plugin provides an interval-gated check-in widget with streak progression, real recent check-in history, and interval-agnostic motivational feedback copy.
`metadata.ts` is eagerly loaded for the plugin catalog while `index.ts` lazily exposes runtime widget definitions.
`widget.tsx` owns helper logic, real 90-day history normalization, switchable Duolingo-style card and classic ring visualizations, ring-only encouragement toast behavior, preset cadence settings, borderless shadowless Check-In CTA styling, lighter burst animations for milestone and overachieve effects, settings toggles, and reset header actions; tests verify behavior contracts.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for habit-streak plugin files and responsibilities. |
| metadata.ts | Plugin metadata | Declares plugin id and widget catalog entry for add-widget discovery (name, icon, layout, etc.). |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin loader wiring. |
| widget.tsx | Widget runtime | Implements streak window helpers, preset cadence normalization, recent local-date history cleanup, switchable Duolingo-style flame/calendar and classic ring streak views, ring-only motivational toast gating, lighter milestone/overachieve bursts, borderless shadowless Check-In CTA styling, and expanded short single-line interval-agnostic motivational templates plus reset behavior via headerButtons. |
| widget.test.tsx | Test suite | Covers helper math, history normalization, dual display-style rendering, toast gating, check-in button states, and header reset behavior. |
