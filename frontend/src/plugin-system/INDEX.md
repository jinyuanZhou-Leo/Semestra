<!-- ⚠️ Once this folder changes, update me. -->

Plugin manager facade for eager metadata/settings discovery, lazy runtime registration, and runtime load-state tracking.
Bridges plugin manifests with internal registries while exposing catalog, metadata, settings, component resolution, and loading transitions through one public layer.
`contracts.ts` defines the plugin authoring helpers and `PluginLoadSkeleton.tsx` provides loading skeleton + fade-in helpers.

| File | Role | Description |
|------|------|-------------|
| contracts.ts | Authoring contracts | Defines `definePluginMetadata`, `definePluginRuntime`, and `definePluginSettings` for plugin declarations. |
| index.ts | Plugin runtime module | Eagerly scans `metadata.ts` and `settings.ts(x)`, lazy-loads `index.ts`, exposes catalog/metadata helpers, and re-registers changed plugin directories during dev HMR. |
| PluginLoadSkeleton.tsx | Plugin runtime module | Loading skeletons and shared fade-in wrapper for lazy tab/widget plugin content. |
| types.ts | Plugin runtime module | Plugin-system module for types concerns. |
| utils.ts | Shared utilities | Shared constants (`DEFAULT_TAB_ALLOWED_CONTEXTS`, `DEFAULT_WIDGET_ALLOWED_CONTEXTS`), `isUnlimitedInstances`, and `jsonDeepEqual` for memoization. |
