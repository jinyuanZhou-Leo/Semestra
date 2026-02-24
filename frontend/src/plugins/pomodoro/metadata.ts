// input:  [lucide-react icon, plugin catalog typing]
// output: [`pluginId` and `widgetCatalog` metadata exports for pomodoro widget]
// pos:    [Plugin metadata entry used by plugin-system eager catalog loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { Timer } from 'lucide-react';
import type { WidgetCatalogItem } from '../../plugin-system/types';

export const pluginId = 'pomodoro';

export const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'pomodoro',
        name: 'Pomodoro Timer',
        description: 'Focus timer with auto-switch between focus and break sessions.',
        icon: createElement(Timer, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 4, minW: 3, minH: 3, maxW: 6, maxH: 8 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];
