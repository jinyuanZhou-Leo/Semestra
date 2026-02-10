import { createElement } from 'react';
import { Hash } from 'lucide-react';
import type { WidgetCatalogItem } from '../../plugin-system/types';

export const pluginId = 'counter';

export const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'counter',
        name: 'Counter',
        description: 'A simple counter widget with controls.',
        icon: createElement(Hash, { className: 'h-4 w-4' }),
        layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 6 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];
