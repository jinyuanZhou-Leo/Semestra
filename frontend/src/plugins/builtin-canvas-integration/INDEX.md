<!-- ⚠️ Once this folder changes, update me. -->

Canvas navigation tab plugin for Canvas-linked courses.
The tab browser now mirrors Canvas web app semantics with a narrow course-navigation rail, top-level Home/Announcements/Modules/Pages entries, and a page submenu only when Pages is active.
Shared helpers keep the plugin ID, Canvas tab-to-section resolution, page-link parsing, and timestamp formatting isolated from the tab runtime, while the tab keeps navigation, announcement, module, page-list, and page-detail queries warm in a longer-lived client cache.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the Canvas integration plugin files. |
| index.ts | Runtime entry | Registers the Canvas pages tab runtime through `definePluginRuntime(...)`. |
| metadata.ts | Plugin metadata | Declares the course-only Canvas pages tab catalog entry. |
| shared.ts | Shared helpers | Stores plugin constants plus Canvas tab-section resolution, landing-target resolution, page-link parsing, and timestamp formatting helpers. |
| tab.test.tsx | Test file | Verifies Canvas-link prompting, backend-driven Home/Announcements/Modules content, and in-tab Canvas page navigation. |
| tab.tsx | Tab runtime | Renders the narrow course-navigation rail, Home/Announcements/Modules/Pages content views, same-course navigation interception, and longer-lived client-side Canvas query caching. |
