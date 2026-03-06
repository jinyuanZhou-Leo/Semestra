import { createElement } from 'react';
import { PanelsTopLeft } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { TabCatalogItem } from '../../plugin-system/types';

const pluginId = 'tab-template';

const tabCatalog: TabCatalogItem[] = [
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

export default definePluginMetadata({
    pluginId,
    tabCatalog,
});
