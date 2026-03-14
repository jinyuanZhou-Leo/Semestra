<!-- ⚠️ Once this folder changes, update me. -->

Service and registry layer for HTTP APIs, TanStack Query infrastructure, plugin registries, and app status.
Defines frontend domain contracts mirroring backend schema responses plus canonical cache keys for shared server-state resources.
Central place for retry policy, cookie-auth HTTP defaults, semester todo APIs, plugin shared settings persistence, query cache setup, and plugin registration rules.

| File | Role | Description |
|------|------|-------------|
| api.ts | Service module | REST gateway for program/semester/course CRUD including Program subject-color-map persistence, provider-neutral LMS integration read/save/validate endpoints, account-wide course-resource list/upload/link/rename/delete/download endpoints, semester todo endpoints without backend-side todo reordering, persisted course colors, plugin shared settings, global user-preference updates, score-based course gradebook endpoints, and widget/tab contracts including force-aware widget deletion. |
| appStatus.ts | Service module | Service abstraction handling app status domain logic. |
| http.ts | Service module | Axios bootstrap that applies API base URL overrides and enables credentialed cookie-auth requests. |
| pluginSettingsRegistry.tsx | Service module | Registry for plugin-global settings sections plus framework-managed shared-settings prop types, with cached per-context snapshots, per-plugin replacement, and `useSyncExternalStore`-safe subscriptions. |
| pluginSettingsRegistry.test.tsx | Test file | Verifies plugin-global settings ordering, context filtering, replacement behavior, and stable cached snapshot references. |
| queryClient.ts | Service module | Shared TanStack Query client singleton with app-wide query/mutation defaults for cache lifetime and retries. |
| queryKeys.ts | Service module | Canonical query-key factory used by contexts, hooks, and plugin surfaces to share cached gradebook, LMS integration, resource, and settings data consistently. |
| retryPolicy.ts | Service module | Service abstraction handling retry policy domain logic. |
| schedule.ts | Service module | Service abstraction handling schedule domain logic. |
| tabRegistry.tsx | Service module | Runtime tab registry that stores loaded tab components plus lifecycle hooks after the plugin facade resolves metadata and lazy runtime modules. |
| widgetRegistry.tsx | Service module | Runtime widget registry that stores loaded widget components, header actions, and instance settings UIs with optional course/semester context props after plugin loading. |
