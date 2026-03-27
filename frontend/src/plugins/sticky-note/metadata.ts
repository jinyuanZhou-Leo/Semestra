// input:  [React icon factory, plugin metadata helpers, and sticky-note widget catalog typing]
// output: [default-exported sticky-note plugin manifest and widget catalog declaration]
// pos:    [plugin manifest entry for the sticky-note widget plugin]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { StickyNote } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'sticky-note';
const pluginIcon = createElement(StickyNote, { className: 'h-4 w-4' });

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'sticky-note',
        name: 'Sticky Note',
        description: 'Quickly capture short notes directly on your dashboard.',
        icon: pluginIcon,
        layout: { w: 2, h: 2, minW: 1, minH: 1, maxW: 5, maxH: 5 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    icon: pluginIcon,
    widgetCatalog,
});
