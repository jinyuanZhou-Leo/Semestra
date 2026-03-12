<!-- ⚠️ Once this folder changes, update me. -->

Service and registry layer for HTTP APIs, plugin registries, and app status.
Defines frontend domain contracts mirroring backend schema responses.
Central place for retry policy, cookie-auth HTTP defaults, semester todo APIs, plugin shared settings persistence, and plugin registration rules.

| File | Role | Description |
|------|------|-------------|
| api.ts | Service module | REST gateway for program/semester/course CRUD including semester todo endpoints, persisted course colors, plugin shared settings, score-based course gradebook endpoints, and widget/tab contracts including force-aware widget deletion. |
| appStatus.ts | Service module | Service abstraction handling app status domain logic. |
| http.ts | Service module | Axios bootstrap that applies API base URL overrides and enables credentialed cookie-auth requests. |
| pluginSettingsRegistry.tsx | Service module | Registry for plugin-global settings sections plus framework-managed shared-settings prop types, with cached per-context snapshots, per-plugin replacement, and `useSyncExternalStore`-safe subscriptions. |
| pluginSettingsRegistry.test.tsx | Test file | Verifies plugin-global settings ordering, context filtering, replacement behavior, and stable cached snapshot references. |
| retryPolicy.ts | Service module | Service abstraction handling retry policy domain logic. |
| schedule.ts | Service module | Service abstraction handling schedule domain logic. |
| tabRegistry.tsx | Service module | Runtime tab registry that stores loaded tab components plus lifecycle hooks after the plugin facade resolves metadata and lazy runtime modules. |
| widgetRegistry.tsx | Service module | Runtime widget registry that stores loaded widget components, header actions, instance settings UIs, and lifecycle hooks after plugin loading. |
