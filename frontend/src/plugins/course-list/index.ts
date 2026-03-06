import { definePluginRuntime } from '../../plugin-system/contracts';

import { CourseListDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [CourseListDefinition],
});
