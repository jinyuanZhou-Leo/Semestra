import { createElement } from 'react';
import { Settings2 } from 'lucide-react';
import type { TabCatalogItem } from '../../plugin-system/types';

export const pluginId = 'builtin-settings';

export const tabCatalog: TabCatalogItem[] = [
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
