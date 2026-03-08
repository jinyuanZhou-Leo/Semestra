<!-- ⚠️ Once this folder changes, update me. -->

Application source root containing entrypoints, routing shell, and domain modules.
Feature behavior is composed from components, contexts, hooks, services, and utilities with context-safe optimistic synchronization.
Auth boot now relies on credentialed cookie sessions instead of browser-stored bearer tokens, with central session refresh and sign-out handling.
The standalone `calendar-core/` domain layer now sits beside `plugins/` so Calendar event contributions can register through a dedicated API rather than the plugin loader.
Plugin implementations live under `plugins/`, including recent UX hardening for course-list feedback, a FullCalendar-backed calendar surface with overflow-to-week access, scroll-first small-screen behavior, tokenized conflict styling, lighter unwrapped today emphasis, draft-friendly calendar time inputs, timezone-safe semester date parsing, semester Reading Week-aware event suppression and week numbering, occurrence-scoped conflict details without top summary badges, registry-backed semester/course todo + schedule Calendar overlays with live refresh, todo destructive confirmations, widget validation/localization behavior, and scoped event-core schedule refresh handling.
Global styling uses a class-driven dark variant to stay consistent with `ThemeProvider`, including the event-core FullCalendar theme bridge, mobile overflow guards, softer today/highlight treatments with a circular month-day badge, matched calendar shell/scrollgrid radii, dark-mode-aware scrollbars, and event surfaces with slim accent rails, subtle corner radii, compact badges, explicit clickable hover/active feedback, and full-width single-event lanes.

| File | Role | Description |
|------|------|-------------|
| assets/ | Subdirectory | Source-level static assets imported by TS/TSX modules. |
| calendar-core/ | Subdirectory | Standalone Calendar source contracts and registry used by Calendar and external event contributors. |
| components/ | Subdirectory | Reusable application components (excluding `components/ui` in this scope), including widget settings overlays that keep their payload mounted through dialog exit animations. |
| contexts/ | Subdirectory | React context providers and related hooks. |
| hooks/ | Subdirectory | Reusable custom React hooks for race-safe data fetching and context-guarded dashboard sync. |
| layouts/ | Subdirectory | Reserved layout abstractions. |
| lib/ | Subdirectory | Small shared helper modules. |
| pages/ | Subdirectory | Route-level page components, including semester/course workspaces with tab content fade-in on every active-tab switch. |
| plugin-system/ | Subdirectory | Plugin catalog/loading runtime layer. |
| plugins/ | Subdirectory | Plugin implementation modules (skipped for now by request). |
| services/ | Subdirectory | HTTP, registry, and app-state service layer. |
| shims/ | Subdirectory | Third-party integration wrapper modules. |
| test/ | Subdirectory | Test bootstrap files. |
| types/ | Subdirectory | Shared type declaration space. |
| utils/ | Subdirectory | Pure utility and helper modules. |
| App.tsx | App shell | Router + provider composition with a product-first root route that sends signed-in users to the workspace and guests to `/login`, while leaving `/landing` as a separate marketing route. |
| index.css | Global styles | Global styles, Tailwind layer imports, class-driven dark variant setup aligned with `ThemeProvider`, and FullCalendar theme/overflow overrides for event-core surfaces. |
| main.tsx | Entry point | Bootstraps React root and imports global runtime setup. |
| tab-setup.ts | Compatibility shim | Legacy-ready promise export for tab plugin compatibility. |
| version.json | Build metadata | Generated app version/build snapshot used in settings UI. |
| widget-setup.ts | Compatibility shim | Legacy-ready promise export for widget plugin compatibility. |
