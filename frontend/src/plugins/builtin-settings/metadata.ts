import { createElement } from 'react';
import { Settings2 } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { TabCatalogItem } from '../../plugin-system/types';

const pluginId = 'builtin-settings';

const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: 'settings',
        name: 'Settings',
        description: 'Built-in settings tab',
        icon: createElement(Settings2, { className: 'h-4 w-4' }),
        maxInstances: 0,
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    tabCatalog,
});
