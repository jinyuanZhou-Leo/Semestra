<!-- ⚠️ Once this folder changes, update me. -->

Counter plugin provides a bounded numeric widget with optional ring visualization and per-instance configuration controls.
`metadata.ts` is loaded eagerly for catalog display while `index.ts` exports runtime definitions lazily.
`widget.tsx` includes widget rendering, settings editing, reset header action, settings normalizer, and accessibility labels for icon controls.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for counter plugin files and responsibilities. |
| counter.md | Design notes | Product/design notes for the counter widget behavior and look-and-feel. |
| metadata.ts | Plugin metadata | Declares plugin id and widget catalog entry metadata (name, icon, layout, etc.). |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin-system loading. |
| widget.tsx | Widget runtime | Implements counter controls, ring progress rendering, `normalizeCounterSettings` defensive normalizer, settings form, and accessible increment/decrement actions. |
