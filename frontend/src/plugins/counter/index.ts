import { definePluginRuntime } from '@/plugin-sdk';

import { CounterDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [CounterDefinition],
});
