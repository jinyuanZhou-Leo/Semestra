<!-- ⚠️ Once this folder changes, update me. -->

`builtin-settings/` provides the built-in Settings tab plugin runtime.
It exposes metadata plus the tab entry that renders core/plugin settings sections.
The tab now measures the live workspace header height so left-side sticky section titles stay visible below the sticky header.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the built-in Settings tab plugin files. |
| index.ts | Runtime entry | Exports the built-in settings tab runtime for plugin registration. |
| metadata.ts | Plugin metadata | Declares the built-in Settings tab metadata shown in the plugin catalog. |
| tab.tsx | Tab runtime | Renders the Settings tab content and injects a dynamic sticky-title offset based on the current workspace header height. |
