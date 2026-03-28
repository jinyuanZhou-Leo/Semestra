// input:  [React icon factory, plugin metadata helpers, and world-clock widget catalog typing]
// output: [default-exported world-clock plugin manifest and widget catalog declaration]
// pos:    [plugin manifest entry for the timezone world-clock widget plugin]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { Clock3 } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'world-clock';
const pluginIcon = createElement(Clock3, { className: 'h-4 w-4' });

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'world-clock',
        name: 'World Clock',
        description: 'Displays current time in a specific timezone.',
        icon: pluginIcon,
        layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    displayName: 'World Clock',
    author: 'Jinyuan',
    description: 'Track time across cities and time zones at a glance.',
    longDescription: 'World Clock makes it easy to stay aware of multiple time zones while studying, collaborating, or planning across regions. It is useful for international students, remote teammates, and anyone balancing classes or meetings across different locations. The experience focuses on fast recognition, so users can check the time they need without extra setup, extra context switching, or mental math.',
    icon: pluginIcon,
    widgetCatalog,
});
