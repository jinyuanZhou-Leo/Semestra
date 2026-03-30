<!-- ⚠️ Once this folder changes, update me. -->

Sticky-note plugin provides a lightweight dashboard note widget for semester and course workspaces.
`plugin.ts` provides the typed descriptor-backed entry while `index.ts` lazily exports the widget runtime.
`widget.tsx` owns inline note editing, persisted widget settings, and plugin-local note presentation.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for sticky-note plugin files and responsibilities. |
| plugin.ts | Plugin entry | Single typed plugin authoring entry that declares widget metadata and lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Exports widget definition and metadata for plugin-system loading. |
| widget.test.tsx | Test suite | Verifies sticky-note widget behavior and editing interactions. |
| widget.tsx | Widget runtime | Renders the sticky-note widget UI, settings handling, and note editing flow. |
