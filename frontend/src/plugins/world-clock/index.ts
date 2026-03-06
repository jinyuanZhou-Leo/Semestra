import { definePluginRuntime } from '../../plugin-system/contracts';

import { WorldClockDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [WorldClockDefinition],
});
