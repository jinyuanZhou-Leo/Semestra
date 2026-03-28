// input:  [React icon factory, plugin metadata helpers, and counter widget catalog typing]
// output: [default-exported counter plugin manifest and widget catalog declaration]
// pos:    [plugin manifest entry for the counter widget plugin]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { Hash } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'counter';
const pluginIcon = createElement(Hash, { className: 'h-4 w-4' });

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'counter',
        name: 'Counter',
        description: 'A simple counter widget with controls.',
        icon: pluginIcon,
        layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 6 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    displayName: 'Counter',
    author: 'Jinyuan',
    description: 'Track simple counts with fast manual updates.',
    longDescription: 'Counter is a minimal tool for keeping track of values that change over time and do not need a full spreadsheet or database. It can be used for repetitions, reading progress, task counts, attendance, or any other quick-running total. Its strength is speed: a clear number, quick controls, and almost no overhead between noticing a change and recording it.',
    icon: pluginIcon,
    supportsUnassignedCourse: true,
    widgetCatalog,
});
