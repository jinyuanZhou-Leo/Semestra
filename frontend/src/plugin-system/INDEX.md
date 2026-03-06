<!-- ⚠️ Once this folder changes, update me. -->

Plugin runtime orchestrator for eager metadata/settings discovery and lazy runtime registration.
Bridges plugin manifests with tab/widget registries, add-modal catalogs, and Settings-page sections.
`utils.ts` provides shared constants and helpers (`isUnlimitedInstances`, `jsonDeepEqual`, default allowed contexts) consumed by registries and the loader.

| File | Role | Description |
|------|------|-------------|
| index.ts | Plugin runtime module | Eagerly scans `metadata.ts` and `settings.ts(x)`, lazy-loads `index.ts`, exposes catalog/metadata helpers, and re-registers changed plugin directories during dev HMR. |
| PluginLoadSkeleton.tsx | Plugin runtime module | Plugin-system module for plugin load skeleton concerns. |
| types.ts | Plugin runtime module | Plugin-system module for types concerns. |
| utils.ts | Shared utilities | Shared constants (`DEFAULT_TAB_ALLOWED_CONTEXTS`, `DEFAULT_WIDGET_ALLOWED_CONTEXTS`), `isUnlimitedInstances`, and `jsonDeepEqual` for memoization. |
