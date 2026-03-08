// input:  [plugin runtime contract and habit-streak widget definitions]
// output: [habit-streak plugin runtime with Duolingo and Ring widget registrations]
// pos:    [lazy runtime entry for the habit-streak plugin]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginRuntime } from '../../plugin-system/contracts';

import { HabitStreakWidgetDefinitions } from './widget';

export default definePluginRuntime({
    widgetDefinitions: HabitStreakWidgetDefinitions,
});
