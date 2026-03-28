// input:  [React icon factory, plugin metadata helpers, and course-list widget catalog typing]
// output: [default-exported course-list plugin manifest and widget catalog declaration]
// pos:    [plugin manifest entry for the Semester course-list widget plugin]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { BookOpenText } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'course-list';
const pluginIcon = createElement(BookOpenText, { className: 'h-4 w-4' });

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'course-list',
        name: 'Course List',
        description: 'Display a list of courses in this semester.',
        icon: pluginIcon,
        layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 6, maxH: 6 },
        maxInstances: 1,
        allowedContexts: ['semester'],
    },
];

export default definePluginMetadata({
    pluginId,
    displayName: 'Course List',
    author: 'Jinyuan',
    description: 'See every course in a semester and manage the overall roster.',
    longDescription: 'Course List is the central overview for the courses that belong to a semester. It helps users scan what they are taking, keep the roster organized, and manage the overall structure of the term from one place. It is especially useful at the start of a semester, when plans are still changing, and later as a stable overview of the academic load that ties the rest of the workspace together.',
    icon: pluginIcon,
    widgetCatalog,
});
