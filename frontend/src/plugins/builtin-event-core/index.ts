import { definePluginRuntime } from '../../plugin-system/contracts';

import { BuiltinTimetableTabDefinitions } from './tab';
import { BuiltinTodayEventsWidgetDefinition } from './widget';

export default definePluginRuntime({
    tabDefinitions: BuiltinTimetableTabDefinitions,
    widgetDefinitions: [BuiltinTodayEventsWidgetDefinition],
});
