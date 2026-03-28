// input:  [React icon factory, plugin metadata helpers, and dashboard tab catalog typing]
// output: [default-exported builtin-dashboard plugin manifest and builtin-dashboard tab catalog declaration]
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
        type: 'builtin-dashboard',
        name: 'Dashboard',
        description: 'Dashboard overview and widget container',
        icon: pluginIcon,
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    displayName: 'Dashboard',
    author: 'Jinyuan',
    description: 'Workspace overview tab and widget entry point.',
    longDescription: 'Dashboard is the default workspace landing tab. It collects widgets, summaries, and shortcuts into a single overview surface for semester and course workspaces.',
    icon: pluginIcon,
    tabCatalog,
});
