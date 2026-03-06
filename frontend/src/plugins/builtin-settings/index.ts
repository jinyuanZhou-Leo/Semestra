import { definePluginRuntime } from '../../plugin-system/contracts';

import { BuiltinSettingsTabDefinition } from './tab';

export default definePluginRuntime({
    tabDefinitions: [BuiltinSettingsTabDefinition],
});
