import { createElement } from 'react';
import { Clock3 } from 'lucide-react';
import type { WidgetCatalogItem } from '../../plugin-system/types';

export const pluginId = 'world-clock';

export const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'world-clock',
        name: 'World Clock',
        description: 'Displays current time in a specific timezone.',
        icon: createElement(Clock3, { className: 'h-4 w-4' }),
        layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];
