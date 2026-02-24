// input:  [pomodoro widget definition module and metadata module]
// output: [runtime exports for widget registration and plugin catalog metadata]
// pos:    [Plugin runtime entry discovered lazily by plugin-system import.meta.glob]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export { PomodoroWidget, PomodoroWidgetDefinition } from './widget';
export { PomodoroWidgetDefinition as widgetDefinition } from './widget';
export { pluginId, widgetCatalog } from './metadata';
