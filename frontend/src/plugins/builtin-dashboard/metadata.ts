// input:  [React icon factory, plugin metadata helpers, and dashboard tab catalog typing]
// output: [default-exported builtin-dashboard plugin manifest and tab catalog declaration]
// pos:    [plugin manifest entry for the built-in dashboard workspace tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { TabCatalogItem } from '../../plugin-system/types';

const pluginId = 'builtin-dashboard';
const pluginIcon = createElement(LayoutDashboard, { className: 'h-4 w-4' });

const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: 'dashboard',
        name: 'Dashboard',
        description: 'Dashboard overview and widget container',
        icon: pluginIcon,
        maxInstances: 0,
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    icon: pluginIcon,
    tabCatalog,
});
