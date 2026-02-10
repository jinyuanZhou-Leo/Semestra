import { createElement } from 'react';
import { PanelsTopLeft } from 'lucide-react';
import type { TabCatalogItem } from '../../plugin-system/types';

export const pluginId = 'tab-template';

export const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: 'tab-template',
        name: 'Tab Template',
        description: 'Starter tab with editable settings and layout scaffolding.',
        icon: createElement(PanelsTopLeft, { className: 'h-4 w-4' }),
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];
