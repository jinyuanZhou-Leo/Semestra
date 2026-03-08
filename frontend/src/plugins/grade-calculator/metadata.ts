// input:  [React icon factory, plugin metadata contract helpers, and widget catalog typing]
// output: [default-exported grade-calculator plugin metadata declaration]
// pos:    [plugin catalog entry describing the grade-calculator widget for course dashboards]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { Calculator } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'grade-calculator';

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'grade-calculator',
        name: 'Grade Calculator',
        description: 'Calculate course grade based on assessment weights.',
        icon: createElement(Calculator, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 3, minW: 2, minH: 2, maxW: 6, maxH: 6 },
        maxInstances: 1,
        allowedContexts: ['course'],
    },
];

export default definePluginMetadata({
    pluginId,
    widgetCatalog,
});
