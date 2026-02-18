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
        layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 8 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];
