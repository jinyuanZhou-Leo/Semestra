<!-- ⚠️ Once this folder changes, update me. -->

Plugin manager facade for eager metadata/plugin-settings discovery, lazy runtime registration, and runtime load-state tracking.
Bridges plugin manifests with internal registries while exposing catalog, metadata, plugin-global settings, instance settings, component resolution, and load-state subscriptions through one public layer.
`contracts.ts` defines the plugin authoring helpers and `PluginLoadSkeleton.tsx` provides loading skeletons plus widget-ring-matched opacity-only loading helpers.

| File | Role | Description |
|------|------|-------------|
| contracts.ts | Authoring contracts | Defines `definePluginMetadata`, `definePluginRuntime`, and `definePluginSettings` for plugin declarations. |
| index.ts | Plugin runtime module | Eagerly scans `metadata.ts` and plugin-global `settings.ts(x)`, lazy-loads `index.ts`, exposes catalog/metadata/settings helpers plus load-state subscriptions, delegates plugin-settings subscriptions to the cached registry hook, and disposes old tab/widget/settings registrations before dev HMR reloads plugin directories. |
| index.test.tsx | Test file | Covers runtime instance settings resolution and eager plugin-global settings exposure through the public facade. |
| PluginLoadSkeleton.tsx | Plugin runtime module | Simple tab loading skeletons, widget-card-aligned loading shells, and a shared opacity-only fade-in wrapper for lazy tab/widget plugin content so fixed children keep viewport positioning. |
| PluginSettingsSectionRenderer.tsx | Bridge component | Resolves one registered plugin settings section into framework-managed shared-settings props and debounced persistence for Settings pages. |
| types.ts | Plugin runtime module | Plugin-system module for types concerns. |
| utils.ts | Shared utilities | Shared constants (`DEFAULT_TAB_ALLOWED_CONTEXTS`, `DEFAULT_WIDGET_ALLOWED_CONTEXTS`), `isUnlimitedInstances`, and `jsonDeepEqual` for memoization. |
