import { definePluginRuntime } from '../../plugin-system/contracts';

import { HabitStreakWidgetDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [HabitStreakWidgetDefinition],
});
