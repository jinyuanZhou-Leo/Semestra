<!-- ⚠️ Once this folder changes, update me. -->

Habit-streak plugin provides an interval-gated check-in widget with streak progression and interval-agnostic motivational feedback copy.
`metadata.ts` is eagerly loaded for the plugin catalog while `index.ts` lazily exposes runtime widget definitions.
`widget.tsx` owns helper logic, theme-adaptive ring rendering (including softer light-mode unfilled track color and subtle orbital ring motion), stronger center text contrast for light mode, precomputed lower-cost particle bursts for milestone and overachieve effects, settings toggles, and reset header actions; tests verify behavior contracts.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for habit-streak plugin files and responsibilities. |
| metadata.ts | Plugin metadata | Declares plugin id and widget catalog entry for add-widget discovery (name, icon, layout, etc.). |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin loader wiring. |
| widget.tsx | Widget runtime | Implements streak window helpers, unique ring gradients per instance, softer light-mode unfilled-track ring contrast, subtle orbital ring animation, stronger center typography contrast in light mode, precomputed lower-cost particle bursts for both 100% milestones and overachieve check-ins, and expanded short single-line interval-agnostic motivational templates with preference toggles plus reset behavior via headerButtons. |
| widget.test.tsx | Test suite | Covers helper math, check-in button states, header reset behavior, and current UI text contract expectations. |
