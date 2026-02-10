import { createElement } from 'react';
import { LayoutDashboard } from 'lucide-react';
import type { TabCatalogItem } from '../../plugin-system/types';

export const pluginId = 'builtin-dashboard';

export const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: 'dashboard',
        name: 'Dashboard',
        description: 'Dashboard overview and widget container',
        icon: createElement(LayoutDashboard, { className: 'h-4 w-4' }),
        maxInstances: 0,
        allowedContexts: ['semester', 'course'],
    },
];
