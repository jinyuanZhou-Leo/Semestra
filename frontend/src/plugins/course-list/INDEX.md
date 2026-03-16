<!-- ⚠️ Once this folder changes, update me. -->

Course-list plugin shows semester-scoped course cards with grade/credit metadata and quick navigation links.
`metadata.ts` is eagerly loaded for plugin catalog usage while `index.ts` lazily exports runtime definitions.
`widget.tsx` and `globalSettings.tsx` expose explicit loading, retry, and failure feedback instead of collapsing errors into empty states.
The plugin-global settings surface now receives framework-managed shared-settings props while still using direct semester management APIs for its builtin-style course operations.
The widget now also resolves Program-level subject-code colors so course tags inherit the same defaults as the larger dashboard views.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for course-list plugin files and responsibilities. |
| globalSettings.test.tsx | Test file | Covers stale semester-response protection and the disabled course-manager entry when semester details fail to load. |
| metadata.ts | Plugin metadata | Declares plugin id and widget catalog entry metadata. |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin loader integration. |
| settings.ts | Settings entry | Registers plugin-global settings sections for semester course management and opts into framework-managed shared-settings props. |
| globalSettings.tsx | Plugin settings UI | Provides shared course-management controls with semester load retry UI, stale-response guards, a mobile-safe `CrudPanel`-aligned semester course table, and a disabled manager entry until semester/program data is valid while remaining compatible with framework-managed plugin settings props. |
| widget.test.tsx | Test file | Covers widget loading, Program color fetches, error alert, and retry behavior for semester course fetches. |
| widget.tsx | Widget runtime | Fetches and renders semester courses with race-safe async updates, Program-derived subject-code tag colors, and explicit loading/error/empty states. |
