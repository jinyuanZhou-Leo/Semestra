import { definePluginRuntime } from '../../plugin-system/contracts';

import { BuiltinDashboardTabDefinition } from './tab';

export default definePluginRuntime({
    tabDefinitions: [BuiltinDashboardTabDefinition],
});
