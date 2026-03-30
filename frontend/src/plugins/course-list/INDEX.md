<!-- ⚠️ Once this folder changes, update me. -->

Course-list plugin shows semester-scoped course cards with grade/credit metadata and quick navigation links.
`plugin.json` and `plugin.ts` now provide the eager descriptor-backed entry while `index.ts` lazily exports runtime definitions.
`widget.tsx` exposes explicit loading, retry, and failure feedback instead of collapsing errors into empty states.
The widget now also resolves Program-level subject-code colors so course tags inherit the same defaults as the larger dashboard views.
The widget reuses a plugin-local GPA-percentage formatter so plugin display logic stays host-decoupled, while semester course management now lives in a host-owned settings section.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for course-list plugin files and responsibilities. |
| format.ts | Plugin helper | Plugin-local one-decimal GPA-percentage formatter reused by the course-list widget and the host-owned semester course-management section without reaching into app-level utilities. |
| plugin.json | Plugin manifest | Static public manifest for plugin identity plus widget metadata shared with the backend. |
| plugin.ts | Plugin entry | Binds the descriptor to lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin loader integration. |
| widget.test.tsx | Test file | Covers widget loading, Program color fetches, error alert, and retry behavior for semester course fetches. |
| widget.tsx | Widget runtime | Fetches and renders semester courses with race-safe async updates, Program-derived subject-code tag colors, plugin-local one-decimal GPA-percentage formatting, and explicit loading/error/empty states. |
