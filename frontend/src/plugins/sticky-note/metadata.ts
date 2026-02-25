import { createElement } from 'react';
import { StickyNote } from 'lucide-react';
import type { WidgetCatalogItem } from '../../plugin-system/types';

export const pluginId = 'sticky-note';

export const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'sticky-note',
        name: 'Sticky Note',
        description: 'Quickly capture short notes directly on your dashboard.',
        icon: createElement(StickyNote, { className: 'h-4 w-4' }),
        layout: { w: 2, h: 2, minW: 1, minH: 1, maxW: 5, maxH: 5 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];
