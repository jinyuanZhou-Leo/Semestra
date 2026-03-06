<!-- ⚠️ Once this folder changes, update me. -->

Service and registry layer for HTTP APIs, plugin registries, and app status.
Defines frontend domain contracts mirroring backend schema responses.
Central place for retry policy, schedule API calls, and plugin registration rules.

| File | Role | Description |
|------|------|-------------|
| api.ts | Service module | Service abstraction handling api domain logic. |
| appStatus.ts | Service module | Service abstraction handling app status domain logic. |
| http.ts | Service module | Service abstraction handling http domain logic. |
| pluginSettingsRegistry.tsx | Service module | Service abstraction handling plugin settings registry domain logic. |
| retryPolicy.ts | Service module | Service abstraction handling retry policy domain logic. |
| schedule.ts | Service module | Service abstraction handling schedule domain logic. |
| tabRegistry.tsx | Service module | Runtime tab registry that stores loaded tab components plus lifecycle hooks after the plugin facade resolves metadata and lazy runtime modules. |
| widgetRegistry.tsx | Service module | Runtime widget registry that stores loaded widget components, header actions, instance settings UIs, and lifecycle hooks after plugin loading. |
