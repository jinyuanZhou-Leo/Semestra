import { createElement } from 'react';
import { BookOpenText } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'course-list';

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'course-list',
        name: 'Course List',
        description: 'Display a list of courses in this semester.',
        icon: createElement(BookOpenText, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 6, maxH: 6 },
        maxInstances: 1,
        allowedContexts: ['semester'],
    },
];

export default definePluginMetadata({
    pluginId,
    widgetCatalog,
});
