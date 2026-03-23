<!-- ⚠️ Once this folder changes, update me. -->

Plugin manager facade for eager metadata/plugin-settings discovery, lazy runtime registration, runtime load-state tracking, workspace-local plugin-host navigation, plugin runtime instance scope, and plugin-local UI-state caching.
Bridges plugin manifests with internal registries while exposing catalog, metadata, plugin-global settings, instance settings, runtime scope helpers, component resolution, load-state subscriptions, the tab-jump host API, and the UI-state cache through one public layer.
`contracts.ts` defines the plugin authoring helpers, `PluginHostContext.tsx` exposes confirmed tab-jump APIs, `PluginRuntimeInstanceContext.tsx` exposes runtime scope boundaries, and `PluginLoadSkeleton.tsx` provides loading skeletons plus widget-ring-matched opacity-only loading helpers.

| File | Role | Description |
|------|------|-------------|
| contracts.ts | Authoring contracts | Defines `definePluginMetadata`, `definePluginRuntime`, and `definePluginSettings` for plugin declarations. |
| PluginUiState.tsx | UI state helpers | Exposes `usePluginUiState` plus browser-backed UI-state cache helpers for transient plugin-local browser state. |
| PluginHostContext.tsx | Host navigation bridge | Provides the workspace-scoped plugin host context and confirmed tab-jump API for tabs and widgets. |
| index.ts | Plugin runtime module | Eagerly scans `metadata.ts` and plugin-global `settings.ts(x)`, lazy-loads `index.ts`, exposes catalog/metadata/settings helpers plus load-state subscriptions, supports idle-time background preloading for still-idle runtimes with typed idle/timer fallback handles, delegates plugin-settings subscriptions to the cached registry hook, re-exports the workspace-local plugin-host navigation context, and disposes old tab/widget/settings registrations before dev HMR reloads plugin directories. |
| PluginHostContext.test.tsx | Test file | Covers confirmed tab jumps, cancelation, missing-target alerts, and ambiguous type resolution for the public plugin host API. |
| PluginUiState.test.tsx | Test file | Verifies UI-state persistence, instance isolation, corruption recovery, invalid-update rejection, and memory fallback when browser storage is unavailable. |
| index.test.tsx | Test file | Covers runtime instance settings resolution, eager plugin-global settings exposure, and idle-time background preloading through the public facade. |
| PluginLoadSkeleton.tsx | Plugin runtime module | Simple tab loading skeletons, widget-card-aligned loading shells, and a shared opacity-only fade-in wrapper for lazy tab/widget plugin content so fixed children keep viewport positioning. |
| PluginRuntimeInstanceContext.tsx | Runtime scope helpers | Defines the widget/tab runtime instance context, provider, and UI-state storage key helpers used by plugin-local transient state. |
| PluginSettingsSectionRenderer.tsx | Bridge component | Resolves one registered plugin settings section into framework-managed shared-settings props and debounced persistence for Settings pages. |
| types.ts | Plugin runtime module | Plugin-system module for types concerns. |
| utils.ts | Shared utilities | Shared constants (`DEFAULT_TAB_ALLOWED_CONTEXTS`, `DEFAULT_WIDGET_ALLOWED_CONTEXTS`), `isUnlimitedInstances`, and `jsonDeepEqual` for memoization. |
