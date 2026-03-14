// input:  [plugin runtime helper and course-resources tab/widget definitions]
// output: [default-exported course-resources runtime registration]
// pos:    [lazy plugin runtime entry that registers the course resources tab and quick-open widget]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginRuntime } from '@/plugin-system/contracts';

import { CourseResourcesTabDefinition } from './tab';
import { CourseResourcesQuickOpenWidgetDefinition } from './widget';

export default definePluginRuntime({
    tabDefinitions: [CourseResourcesTabDefinition],
    widgetDefinitions: [CourseResourcesQuickOpenWidgetDefinition],
});
