// input:  [pomodoro widget definition module and metadata module]
// output: [runtime exports plus default `definePluginRuntime(...)` declaration for lazy widget registration]
// pos:    [Plugin runtime entry discovered lazily by plugin-system import.meta.glob]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginRuntime } from '../../plugin-system/contracts';

import { PomodoroWidgetDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [PomodoroWidgetDefinition],
});
