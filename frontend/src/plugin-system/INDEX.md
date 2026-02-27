<!-- ⚠️ Once this folder changes, update me. -->

Plugin runtime orchestrator, metadata/catalog resolution layer, and shared utilities.
Handles lazy plugin loading, catalog availability, fallback skeleton rendering, and dev-time plugin HMR refresh via plugin-directory re-registration.
Bridges plugin manifests with tab/widget registries and settings registries.
`utils.ts` provides shared constants and helpers (`isUnlimitedInstances`, `jsonDeepEqual`, default allowed contexts) consumed by registries and the plugin orchestrator.

| File | Role | Description |
|------|------|-------------|
| index.ts | Plugin runtime module | Orchestrates metadata/settings/runtime loading, catalog helpers, and plugin-directory-based HMR re-registration so tab/widget edits apply immediately in dev. |
| PluginLoadSkeleton.tsx | Plugin runtime module | Plugin-system module for plugin load skeleton concerns. |
| types.ts | Plugin runtime module | Plugin-system module for types concerns. |
| utils.ts | Shared utilities | Shared constants (`DEFAULT_TAB_ALLOWED_CONTEXTS`, `DEFAULT_WIDGET_ALLOWED_CONTEXTS`), `isUnlimitedInstances`, and `jsonDeepEqual` for memoization. |
