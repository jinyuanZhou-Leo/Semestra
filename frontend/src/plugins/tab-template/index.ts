import { definePluginRuntime } from '../../plugin-system/contracts';

import { TemplateTabDefinition } from './tab';

export default definePluginRuntime({
    tabDefinitions: [TemplateTabDefinition],
});
