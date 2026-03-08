// input:  [event-core tab/widget definitions plus builtin calendar source registration side effects]
// output: [default plugin runtime declaration for builtin-event-core]
// pos:    [runtime entrypoint that exposes builtin-event-core tabs/widgets while ensuring Calendar sources are registered]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginRuntime } from '../../plugin-system/contracts';

import { BuiltinTimetableTabDefinitions } from './tab';
import { BuiltinTodayEventsWidgetDefinition } from './widget';
import { ensureBuiltinCalendarSourcesRegistered } from './tabs/calendar/sources/registerBuiltinCalendarSources';

ensureBuiltinCalendarSourcesRegistered();

export default definePluginRuntime({
    tabDefinitions: BuiltinTimetableTabDefinitions,
    widgetDefinitions: [BuiltinTodayEventsWidgetDefinition],
});
