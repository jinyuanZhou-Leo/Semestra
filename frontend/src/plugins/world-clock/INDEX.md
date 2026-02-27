<!-- ⚠️ Once this folder changes, update me. -->

World-clock plugin renders timezone-aware time/date output with configurable second-level or minute-level refresh cadence.
`metadata.ts` provides eager plugin catalog metadata while `index.ts` lazily registers widget runtime exports.
`widget.tsx` contains both settings controls and the runtime clock formatter/update loop.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for world-clock plugin files and responsibilities. |
| metadata.ts | Plugin metadata | Declares plugin id and widget catalog listing metadata (name, icon, layout, etc.). |
| index.ts | Runtime entry | Exports runtime widget definition and metadata exports for plugin loading. |
| widget.tsx | Widget runtime | Renders timezone clock UI and updates at 1s or 60s cadence based on `showSeconds`. |
