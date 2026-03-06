import { definePluginRuntime } from '../../plugin-system/contracts';

import { CounterDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [CounterDefinition],
});
