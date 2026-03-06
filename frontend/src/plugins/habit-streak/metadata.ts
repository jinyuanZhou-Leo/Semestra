import { createElement } from 'react';
import { Flame } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'habit-streak';

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'habit-streak',
        name: 'Habit Streak',
        description: 'Build momentum with interval-based check-ins and streak tracking.',
        icon: createElement(Flame, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 4, minW: 2, minH: 2, maxW: 6, maxH: 6 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    widgetCatalog,
});
