<!-- ⚠️ Once this folder changes, update me. -->

Course-list plugin shows semester-scoped course cards with grade/credit metadata and quick navigation links.
`metadata.ts` is eagerly loaded for plugin catalog usage while `index.ts` lazily exports runtime definitions.
`widget.tsx` and `globalSettings.tsx` now expose explicit loading, retry, and failure feedback instead of collapsing errors into empty states.
The global settings surface now ignores stale semester responses and only opens course management after a valid semester/program payload is loaded.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for course-list plugin files and responsibilities. |
| globalSettings.test.tsx | Test file | Covers stale semester-response protection and the disabled course-manager entry when semester details fail to load. |
| metadata.ts | Plugin metadata | Declares plugin id and widget catalog entry metadata. |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin loader integration. |
| settings.ts | Settings entry | Exposes eager settings arrays used by plugin settings framework. |
| globalSettings.tsx | Global settings UI | Provides shared/global configuration controls with semester load retry UI, stale-response guards, and a disabled manager entry until semester/program data is valid. |
| widget.test.tsx | Test file | Covers widget loading, error alert, and retry behavior for semester course fetches. |
| widget.tsx | Widget runtime | Fetches and renders semester courses with race-safe async updates plus explicit loading/error/empty states. |
