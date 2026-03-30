import { definePluginRuntime } from '@/plugin-sdk';

import { WorldClockDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [WorldClockDefinition],
});
