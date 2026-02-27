<!-- ⚠️ Once this folder changes, update me. -->

Application source root containing entrypoints, routing shell, and domain modules.
Feature behavior is composed from components, contexts, hooks, services, and utilities with context-safe optimistic synchronization.
Plugin implementations live under `plugins/` (currently intentionally skipped in this pass), and global styling uses a class-driven dark variant to stay consistent with `ThemeProvider`.

| File | Role | Description |
|------|------|-------------|
| assets/ | Subdirectory | Source-level static assets imported by TS/TSX modules. |
| components/ | Subdirectory | Reusable application components (excluding `components/ui` in this scope). |
| contexts/ | Subdirectory | React context providers and related hooks. |
| hooks/ | Subdirectory | Reusable custom React hooks for race-safe data fetching and context-guarded dashboard sync. |
| layouts/ | Subdirectory | Reserved layout abstractions. |
| lib/ | Subdirectory | Small shared helper modules. |
| pages/ | Subdirectory | Route-level page components. |
| plugin-system/ | Subdirectory | Plugin catalog/loading runtime layer. |
| plugins/ | Subdirectory | Plugin implementation modules (skipped for now by request). |
| services/ | Subdirectory | HTTP, registry, and app-state service layer. |
| shims/ | Subdirectory | Third-party integration wrapper modules. |
| test/ | Subdirectory | Test bootstrap files. |
| types/ | Subdirectory | Shared type declaration space. |
| utils/ | Subdirectory | Pure utility and helper modules. |
| App.tsx | App shell | Router + provider composition and lazy route registration. |
| index.css | Global styles | Global styles, Tailwind layer imports, and class-driven dark variant setup aligned with `ThemeProvider`. |
| main.tsx | Entry point | Bootstraps React root and imports global runtime setup. |
| tab-setup.ts | Compatibility shim | Legacy-ready promise export for tab plugin compatibility. |
| version.json | Build metadata | Generated app version/build snapshot used in settings UI. |
| widget-setup.ts | Compatibility shim | Legacy-ready promise export for widget plugin compatibility. |
