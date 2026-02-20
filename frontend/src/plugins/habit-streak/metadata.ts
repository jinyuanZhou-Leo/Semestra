import { createElement } from 'react';
import { Flame } from 'lucide-react';
import type { WidgetCatalogItem } from '../../plugin-system/types';

export const pluginId = 'habit-streak';

export const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'habit-streak',
        name: 'Habit Streak',
        description: 'Build momentum with interval-based check-ins and streak tracking.',
        icon: createElement(Flame, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 4, minW: 3, minH: 3, maxW: 7, maxH: 8 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];
