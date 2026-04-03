<!-- ⚠️ Once this folder changes, update me. -->

Plugin manager facade for eager plugin-entry discovery, lazy runtime registration, runtime load-state tracking, workspace-local plugin-host navigation, plugin runtime instance scope, and plugin-local UI-state caching.
It consumes single-entry `plugins/*/plugin.ts` authoring modules plus private `host-policy.json`, while the backend separately consumes generated `*.plugin.json` and optional `*.setup.schema.json` artifacts.
Public plugin authoring now lives in `plugin-sdk/`; this folder keeps only runtime/loading/catalog internals plus app-facing host/setup bridges.
`host-api.ts`, `public-types.ts`, and `settings-sections.ts` expose the stable app/runtime surfaces, while `index.ts` keeps descriptor discovery and HMR orchestration as the facade core. `pluginCatalog.ts`, `pluginLoadState.ts`, and `pluginRuntimeLoader.ts` hold the catalog-index, load-state, and runtime-registration internals; `setup.ts` now treats `setup.tsx` as the plugin-owned source of truth, exposes setup as a host-provided component tree plus optional plugin-owned setup/review overrides, requires each setup field to declare its owning `settingsKey`, and serializes that same definition back into backend-readable schema so wizard setup writes can land directly in generic runtime `tab_settings`; `pluginSettingsPanelContext.tsx` and `pluginSettingsFields.tsx` now provide the parallel frontend-only binding layer for `settings.tsx` plugin panels so common shadcn field templates can read/write `settings_key` buckets and expose reusable field/bucket hooks without introducing a second settings schema; `setupRegistry.ts` validates eager setup definitions from `plugin.ts`; `PluginHostContext.tsx` exposes confirmed tab-jump APIs; `PluginLoadSkeleton.tsx` provides loading skeletons plus widget-ring-matched opacity-only loading helpers; and `tabSettingsMeta.ts` centralizes the small type/helper surface for per-key tab-setting layer/source labels.

## Plugin Settings Layers

### Layer A: Standard fields

`pluginSettingsFields.tsx` exposes bound text, textarea, number, boolean, select, date, and JSON controls for plugin settings panels. These host components handle persistence automatically.

### Layer B: Custom controls

When a plugin needs custom rendering for one field, use `usePluginSettingField(...)` together with `PluginSettingsFieldLabelRow`. This keeps custom controls aligned with the host settings UX without reaching into plugin-system internals.

### Layer C: Fully custom settings panels

When a plugin section manages a compound settings object or drives its own CRUD surface, use `usePluginSettingsBucket(...)` for bucket-level persistence and `usePluginSettingsContext()` for the current `pluginId`, scope, and refresh callback.

| File | Role | Description |
|------|------|-------------|
| host-api.ts | Public host surface | Curated runtime host exports for confirmed tab jumps, runtime instance scope, plugin UI-state caching, and loading shells. |
| pluginCatalog.ts | Internal helper | Builds manifest/catalog ownership indexes, resolved metadata helpers, and addability checks so `index.ts` can stay focused on orchestration. |
| pluginLoadState.ts | Internal helper | Centralizes plugin load-state subscriptions, version tracking, and browser-idle scheduling helpers. |
| pluginRuntimeLoader.ts | Internal helper | Defines plugin entry shape plus runtime validation and tab/widget registration helpers for lazy plugin loads. |
| PluginUiState.tsx | UI state helpers | Exposes `usePluginUiState` plus browser-backed UI-state cache helpers for transient plugin-local browser state. |
| PluginHostContext.tsx | Host navigation bridge | Provides the workspace-scoped plugin host context and confirmed tab-jump API for tabs and widgets. |
| index.ts | Plugin runtime module | Eagerly scans `plugin.ts` authoring entries, applies private host policy, lazy-loads plugin runtimes, exposes plugin-manifest icon/setup helpers plus setup-registry access, filters host-shell entries out of public catalogs, exposes tab/widget-type ownership lookups, re-exports the host/public-type/settings-section surfaces, and disposes old tab/widget/settings registrations before dev HMR reloads plugin directories while delegating catalog/load-state/runtime registration internals to helper modules. |
| PluginHostContext.test.tsx | Test file | Covers confirmed tab jumps, cancelation, missing-target alerts, and ambiguous type resolution for the public plugin host API. |
| iconResolver.test.tsx | Test file | Verifies typed lucide component icons and asset-path icons both resolve into renderable catalog icons. |
| PluginUiState.test.tsx | Test file | Verifies UI-state persistence, instance isolation, corruption recovery, invalid-update rejection, and memory fallback when browser storage is unavailable. |
| index.test.tsx | Test file | Covers plugin-manifest icon exposure, runtime instance settings resolution, omission of removed host-owned settings sections from the plugin facade, eager setup registration, and idle-time background preloading through the public facade. |
| PluginLoadSkeleton.tsx | Plugin runtime module | Simple tab loading skeletons, widget-card-aligned loading shells, and a shared opacity-only fade-in wrapper for lazy tab/widget plugin content so fixed children keep viewport positioning. |
| PluginRuntimeInstanceContext.tsx | Runtime scope helpers | Defines the widget/tab runtime instance context, provider, and UI-state storage key helpers used by plugin-local transient state. |
| pluginSettingsFields.test.tsx | Test file | Covers bound plugin settings hooks/components, scoped persistence, and custom settings-panel UI placement. |
| pluginSettingsFields.tsx | Settings binding layer | Provides settings-panel bucket/field hooks plus common shadcn field templates that bind directly to scope-aware `tab_settings` buckets. |
| pluginSettingsPanelContext.tsx | Settings panel context | Supplies the current plugin id, scope, and refresh callback to bound settings helpers inside host-rendered plugin settings panels. |
| PluginSettingsSectionRenderer.tsx | Bridge component | Resolves one registered plugin settings section into a stable `pluginId + scope + onRefresh` contract and a simpler shadcn card header for Program, Semester, and Course settings pages. |
| PluginSettingsSectionRenderer.test.tsx | Test file | Verifies the shared settings-section bridge renders plugin identity headers and injects the expected scope-aware contract into plugin settings components. |
| public-types.ts | Public type surface | Re-exports tab/widget runtime definition and prop types plus manifest/catalog contracts so plugin authors can stay on `@/plugin-system`. |
| settings-sections.ts | Public settings surface | Curated settings-section exports for renderer, registry types, and registry access helpers. |
| tabSettingsMeta.ts | Settings metadata helper | Defines the shared tab-setting layer/source types used by the settings persistence flow and normalized API data. |
| setup.ts | Setup contract | Component-tree authoring contract for plugin setup definitions, including host-provided section and field components plus optional plugin-owned setup/review override components, field-level `settingsKey` ownership, default-value resolution, validation helpers for wizard Next-step gating, serialization back into backend-readable schema, and adapters that let `plugin.ts` source setup directly from `setup.tsx` without a second setup schema. |
| setupRegistry.test.ts | Test file | Verifies setup-definition validation rules and eager descriptor-backed setup registration for builtin-event-core. |
| setupRegistry.ts | Setup registry | Eagerly scans `plugins/*/plugin.ts`, validates each setup declaration against its plugin definition, and keeps custom UI/validation hooks available to the frontend wizard around raw plugin-owned `setup_values`. |
| runtimeAvailability.test.ts | Test file | Verifies that plugin-owned tabs/widgets are hidden when disabled upstream and that the helper only consumes the API-normalized runtime contract. |
| runtimeAvailability.ts | Runtime adapter | Consumes the single normalized `runtime` payload from the API layer and derives tab/widget-level availability, resolved tabs, available widgets, and enabled-plugin filtering helpers for persisted runtime tabs/widgets without carrying wire-shape fallback logic. |
| types.ts | Plugin runtime module | Shared plugin-manifest, tab/widget catalog, widget-layout, and resolved-metadata type contracts. |
| utils.ts | Shared utilities | Shared constants (`DEFAULT_TAB_ALLOWED_CONTEXTS`, `DEFAULT_WIDGET_ALLOWED_CONTEXTS`), `isUnlimitedInstances`, and `jsonDeepEqual` for memoization. |
