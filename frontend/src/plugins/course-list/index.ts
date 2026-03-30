import { definePluginRuntime } from '@/plugin-sdk';

import { CourseListDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [CourseListDefinition],
});
