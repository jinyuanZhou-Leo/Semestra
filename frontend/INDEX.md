<!-- ⚠️ Once this folder changes, update me. -->

Vite + React frontend for Semestra with lazy routes and plugin-driven dashboards.
Core behavior is split across contexts, hooks, services, and reusable UI components, including context-safe optimistic sync, glassmorphism widget header controls, and state-driven modal animations.
Build/test configs and scripts support local development, bundling, and release metadata.

| File | Role | Description |
|------|------|-------------|
| public/ | Subdirectory | Public static asset directory served as-is by Vite. |
| scripts/ | Subdirectory | Tooling scripts triggered by npm lifecycle hooks. |
| src/ | Subdirectory | Frontend application source code root. |
| src/plugins/INDEX.md | Plugin architecture index | Catalog map of built-in and custom plugin folders with loader contracts. |
| src/plugins/pomodoro/INDEX.md | Plugin architecture index | File map for Pomodoro timer widget plugin runtime, metadata, and tests. |
| .env | Environment file | Local frontend environment variables for development. |
| components.json | shadcn config | shadcn/ui registry and alias configuration. |
| eslint.config.js | Lint config | ESLint ruleset for TypeScript + React hooks. |
| index.html | HTML entry | Root HTML template with pre-React loading fallback. |
| package-lock.json | Dependency lockfile | Pinned npm dependency tree for reproducible installs. |
| package.json | Package manifest | Frontend scripts, dependencies, and package metadata. |
| README.md | Guide | Baseline React+Vite README and project notes. |
| tailwind.config.ts | Style config | Tailwind scanning configuration and theme wiring. |
| tsconfig.app.json | TypeScript config | Application TypeScript compiler options. |
| tsconfig.json | TypeScript config | Top-level TypeScript project references/config. |
| tsconfig.node.json | TypeScript config | Node-targeted TypeScript config for tooling files. |
| vercel.json | Deploy config | Vercel deployment behavior/configuration for frontend. |
| vite.config.ts | Build config | Vite/Vitest config with plugin setup and chunk strategy. |
