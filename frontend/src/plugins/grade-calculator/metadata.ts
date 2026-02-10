import { createElement } from 'react';
import { Calculator } from 'lucide-react';
import type { WidgetCatalogItem } from '../../plugin-system/types';

export const pluginId = 'grade-calculator';

export const widgetCatalog: WidgetCatalogItem[] = [
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
