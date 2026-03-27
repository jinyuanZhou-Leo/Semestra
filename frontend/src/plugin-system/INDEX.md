<!-- ⚠️ Once this folder changes, update me. -->

Plugin manager facade for eager plugin-manifest, plugin-settings, and plugin-setup discovery, lazy runtime registration, runtime load-state tracking, workspace-local plugin-host navigation, plugin runtime instance scope, and plugin-local UI-state caching.
Bridges backend-owned plugin identity with frontend-owned manifests and setup DSL so governance UIs read `name/description/author` from APIs while the runtime still resolves plugin icons, contribution catalogs, and generated setup contracts locally.
`contracts.ts` defines the plugin authoring helpers, `setup.ts` exposes the pure setup DSL, `setupRegistry.ts` validates and serializes setup definitions, `PluginHostContext.tsx` exposes confirmed tab-jump APIs, and `PluginLoadSkeleton.tsx` provides loading skeletons plus widget-ring-matched opacity-only loading helpers.

| File | Role | Description |
|------|------|-------------|
| contracts.ts | Authoring contracts | Defines `definePluginMetadata`, `definePluginRuntime`, and `definePluginSettings` authoring helpers and re-exports the setup-definition contract type used by the setup DSL. |
| PluginUiState.tsx | UI state helpers | Exposes `usePluginUiState` plus browser-backed UI-state cache helpers for transient plugin-local browser state. |
| PluginHostContext.tsx | Host navigation bridge | Provides the workspace-scoped plugin host context and confirmed tab-jump API for tabs and widgets. |
| index.ts | Plugin runtime module | Eagerly scans `metadata.ts`, plugin-global `settings.ts(x)`, and setup definitions, lazy-loads `index.ts`, exposes plugin-manifest icon/setup helpers plus tab/widget catalogs, supports idle-time background preloading for still-idle runtimes with typed idle/timer fallback handles, delegates plugin-settings subscriptions to the cached registry hook, re-exports the workspace-local plugin-host navigation context, and disposes old tab/widget/settings registrations before dev HMR reloads plugin directories. |
| PluginHostContext.test.tsx | Test file | Covers confirmed tab jumps, cancelation, missing-target alerts, and ambiguous type resolution for the public plugin host API. |
| PluginUiState.test.tsx | Test file | Verifies UI-state persistence, instance isolation, corruption recovery, invalid-update rejection, and memory fallback when browser storage is unavailable. |
| index.test.tsx | Test file | Covers plugin-manifest icon exposure, runtime instance settings resolution, eager plugin-global settings/setup exposure, and idle-time background preloading through the public facade. |
| PluginLoadSkeleton.tsx | Plugin runtime module | Simple tab loading skeletons, widget-card-aligned loading shells, and a shared opacity-only fade-in wrapper for lazy tab/widget plugin content so fixed children keep viewport positioning. |
| PluginRuntimeInstanceContext.tsx | Runtime scope helpers | Defines the widget/tab runtime instance context, provider, and UI-state storage key helpers used by plugin-local transient state. |
| PluginSettingsSectionRenderer.tsx | Bridge component | Resolves one registered plugin settings section into framework-managed shared-settings props, seeded resolved config, and debounced persistence for Settings pages while rendering a shared plugin header with manifest icon plus backend-sourced display metadata when available. |
| PluginSettingsSectionRenderer.test.tsx | Test file | Verifies the shared plugin-settings bridge renders plugin identity headers and still injects framework-managed shared-settings props into plugin settings components. |
| setup.ts | Setup DSL | Pure field/section authoring DSL for host-rendered plugin setup definitions plus type inference for setup values. |
| setupRegistry.test.ts | Test file | Verifies setup-definition validation rules and generated backend manifest serialization. |
| setupRegistry.ts | Setup registry | Eagerly scans `plugins/*/setup.ts`, validates each setup declaration against plugin metadata ownership, and serializes stable manifest payloads for the backend plugin-system. |
| runtimeGovernance.ts | Runtime adapter | Normalizes Semester/Course runtime governance payloads from Program-installed plus Semester-enabled plugin contracts into enabled plugin ids, resolved tabs, available widgets, and resolved plugin settings for runtime pages. |
| types.ts | Plugin runtime module | Shared plugin-manifest, tab/widget catalog, widget-layout, and resolved-metadata type contracts. |
| utils.ts | Shared utilities | Shared constants (`DEFAULT_TAB_ALLOWED_CONTEXTS`, `DEFAULT_WIDGET_ALLOWED_CONTEXTS`), `isUnlimitedInstances`, and `jsonDeepEqual` for memoization. |
