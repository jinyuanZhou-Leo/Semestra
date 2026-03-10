<!-- ⚠️ Once this folder changes, update me. -->

Vite + React frontend for Semestra with lazy routes and plugin-driven dashboards.
Core behavior is split across contexts, hooks, services, reusable UI components, and a standalone `src/calendar-core/` domain layer for Calendar event-source registration.
Build/test configs and scripts support local development, bundling, release metadata, cookie-backed auth bootstrapping, compact calendar/todo loading shells, a single-shell Calendar border treatment with refined scrollbars, dynamic sticky offsets for workspace settings titles, debounced settings auto-save persistence without inline status UI, homepage-aware plugin loading skeletons, a Gradebook command-center refresh with Program Homepage-style assessment browsing, and the split habit-streak dual-widget runtime with isolated per-instance streak data so the browser no longer persists login bearer tokens in localStorage.

| File | Role | Description |
|------|------|-------------|
| public/ | Subdirectory | Public static asset directory served as-is by Vite. |
| scripts/ | Subdirectory | Tooling scripts triggered by npm lifecycle hooks. |
| src/ | Subdirectory | Frontend application source code root. |
| src/plugins/INDEX.md | Plugin architecture index | Catalog map of built-in and custom plugin folders with loader contracts, including the built-in settings tab architecture index. |
| src/plugins/pomodoro/INDEX.md | Plugin architecture index | File map for Pomodoro timer widget plugin runtime, metadata, and tests. |
| .env | Environment file | Local frontend environment variables for development. |
| components.json | shadcn config | shadcn/ui registry and alias configuration. |
| eslint.config.js | Lint config | ESLint ruleset for TypeScript + React hooks. |
| index.html | HTML entry | Root HTML template with pre-React loading fallback. |
| package-lock.json | Dependency lockfile | Pinned npm dependency tree for reproducible installs. |
| package.json | Package manifest | Frontend scripts, dependencies, and package metadata for the current settings UI cleanup, Gradebook command-center refresh, split habit-streak dual-widget runtime, multi-instance support, and homepage loading-shell behavior. |
| README.md | Guide | Baseline React+Vite README and project notes. |
| tailwind.config.ts | Style config | Tailwind scanning configuration and theme wiring. |
| tsconfig.app.json | TypeScript config | Application TypeScript compiler options. |
| tsconfig.json | TypeScript config | Top-level TypeScript project references/config. |
| tsconfig.node.json | TypeScript config | Node-targeted TypeScript config for tooling files. |
| vercel.json | Deploy config | Vercel deployment behavior/configuration for frontend. |
| vite.config.ts | Build config | Vite/Vitest config with plugin setup and chunk strategy. |
