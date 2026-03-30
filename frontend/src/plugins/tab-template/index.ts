import { definePluginRuntime } from '@/plugin-sdk';

import { TemplateTabDefinition } from './tab';

export default definePluginRuntime({
    tabDefinitions: [TemplateTabDefinition],
});
