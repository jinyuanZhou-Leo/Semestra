<!-- ⚠️ Once this folder changes, update me. -->

Counter plugin provides a bounded numeric widget with optional ring visualization and per-instance configuration controls.
`plugin.json` and `plugin.ts` now provide the eager descriptor-backed entry while `index.ts` exports runtime definitions lazily.
`widget.tsx` includes widget rendering, settings editing, reset header action, range sanitization, inline validation feedback, and accessibility labels for icon controls.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for counter plugin files and responsibilities. |
| counter.md | Design notes | Product/design notes for the counter widget behavior and look-and-feel. |
| plugin.json | Plugin manifest | Static public manifest for plugin identity plus widget metadata shared with the backend. |
| plugin.ts | Plugin entry | Binds the descriptor to lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin-system loading. |
| widget.tsx | Widget runtime | Implements counter controls, ring progress rendering, range sanitization/clamping, validation messaging, settings form, and compiler-safe accessible increment/decrement actions. |
