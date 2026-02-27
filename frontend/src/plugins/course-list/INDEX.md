<!-- ⚠️ Once this folder changes, update me. -->

Course-list plugin shows semester-scoped course cards with grade/credit metadata and quick navigation links.
`metadata.ts` is eagerly loaded for plugin catalog usage while `index.ts` lazily exports runtime definitions.
`widget.tsx` handles API-backed loading with stale-response guards and safe error handling for semester switches.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for course-list plugin files and responsibilities. |
| metadata.ts | Plugin metadata | Declares plugin id and widget catalog entry metadata. |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin loader integration. |
| settings.ts | Settings entry | Exposes eager settings arrays used by plugin settings framework. |
| globalSettings.tsx | Global settings UI | Provides shared/global configuration controls for course list presentation. |
| widget.tsx | Widget runtime | Fetches and renders semester courses with race-safe async updates and fallback error handling. |
