<!-- ⚠️ Once this folder changes, update me. -->

Hook-level unit tests for low-level environment/reactivity behavior.
Current coverage targets centralized touch-device detection logic plus dashboard widget deletion and settings-page runtime/plugin-shared-settings preloading/sync behavior.
Prevents regressions in shared global listener management, unavailable-widget force deletion, inactive-tab settings availability, debounced plugin settings persistence, and Query-backed provider wiring for hook tests.

| File | Role | Description |
|------|------|-------------|
| useDashboardWidgets.test.tsx | Test file | Verifies unavailable widgets route deletion through the force-enabled API path without changing the default delete contract. |
| usePluginSharedSettings.test.tsx | Test file | Verifies plugin-level shared settings load correctly and remain debounced across rerenders before the framework autosave flushes them. |
| useTouchDevice.test.tsx | Test file | Test coverage for use touch device.test behavior. |
| useVisibleTabSettingsPreload.test.tsx | Test file | Verifies that visible tab runtimes preload when the Settings page needs inactive-tab settings sections. |
