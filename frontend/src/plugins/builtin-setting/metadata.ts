// input:  [React icon factory, plugin metadata helpers, and settings tab catalog typing]
// output: [default-exported builtin-setting plugin manifest and builtin-setting tab catalog declaration]
// pos:    [plugin manifest entry for the built-in settings workspace tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { Settings2 } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { TabCatalogItem } from '../../plugin-system/types';

const pluginId = 'builtin-setting';
const pluginIcon = createElement(Settings2, { className: 'h-4 w-4' });

const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: 'builtin-setting',
        name: 'Settings',
        description: 'Built-in settings tab',
        icon: pluginIcon,
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    displayName: 'Settings',
    author: 'Jinyuan',
    description: 'Workspace settings and configuration surfaces.',
    longDescription: 'Settings is the built-in configuration surface for semester and course workspaces. It centralizes plugin setup, workspace preferences, and integration-specific controls.',
    icon: pluginIcon,
    supportsUnassignedCourse: true,
    tabCatalog,
});
