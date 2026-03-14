<!-- ⚠️ Once this folder changes, update me. -->

Global test bootstrap for frontend Vitest runs.
Configures shared matchers, cleanup hooks, and reusable provider wrappers for isolated query-cache tests.
Loaded automatically via Vite test config setupFiles, with extra helpers imported by hook/component suites as needed.

| File | Role | Description |
|------|------|-------------|
| queryClientWrapper.tsx | Test helper | Builds a fresh QueryClientProvider wrapper for hook/component tests that exercise TanStack Query state. |
| setup.ts | Utility module | Vitest global setup for DOM matchers and cleanup. |
