<!-- ⚠️ Once this folder changes, update me. -->

Hook-level unit tests for low-level environment/reactivity behavior.
Current coverage targets centralized touch-device detection logic plus settings-page runtime and plugin-shared-settings preloading/sync behavior.
Prevents regressions in shared global listener management, inactive-tab settings availability, and debounced plugin settings persistence.

| File | Role | Description |
|------|------|-------------|
| usePluginSharedSettings.test.tsx | Test file | Verifies plugin-level shared settings load correctly and remain debounced across rerenders before the framework autosave flushes them. |
| useTouchDevice.test.tsx | Test file | Test coverage for use touch device.test behavior. |
| useVisibleTabSettingsPreload.test.tsx | Test file | Verifies that visible tab runtimes preload when the Settings page needs inactive-tab settings sections. |
