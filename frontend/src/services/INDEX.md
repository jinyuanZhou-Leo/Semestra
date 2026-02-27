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
| tabRegistry.tsx | Service module | Service abstraction handling tab registry domain logic. |
| widgetRegistry.tsx | Service module | Widget definition registry including layout constraints and optional aspect-ratio configuration. |
