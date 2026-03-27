// input:  [React icon factory, plugin metadata helpers, and tab-template catalog typing]
// output: [default-exported tab-template plugin manifest and tab catalog declaration]
// pos:    [plugin manifest entry for the starter tab plugin]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { PanelsTopLeft } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { TabCatalogItem } from '../../plugin-system/types';

const pluginId = 'tab-template';
const pluginIcon = createElement(PanelsTopLeft, { className: 'h-4 w-4' });

const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: 'tab-template',
        name: 'Tab Template',
        description: 'Starter tab with editable settings and layout scaffolding.',
        icon: pluginIcon,
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    icon: pluginIcon,
    tabCatalog,
});
