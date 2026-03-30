<!-- ⚠️ Once this folder changes, update me. -->

`builtin-setting/` provides the built-in Settings host-shell tab plugin runtime.
`plugin.ts` now exposes the shared typed descriptor-backed identity while `tab.tsx` renders core/plugin settings sections.
The tab now measures the live workspace header height so left-side sticky section titles stay visible below the sticky header.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the built-in Settings tab plugin files. |
| plugin.ts | Plugin entry | Single typed plugin authoring entry that declares settings metadata and lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Exports the builtin-setting tab runtime for plugin registration. |
| tab.tsx | Tab runtime | Renders the builtin-setting tab content and injects a dynamic sticky-title offset based on the current workspace header height. |
