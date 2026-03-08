// input:  [React element factory, lucide icons, and plugin metadata contract]
// output: [habit-streak plugin metadata with Duolingo and Ring widget catalog entries]
// pos:    [eager metadata entry for add-widget discovery]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { CalendarDays, Flame } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'habit-streak';

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'habit-streak-duolingo',
        name: 'Habit Streak Duolingo',
        description: 'Track your streak with the Duolingo-style week board.',
        icon: createElement(CalendarDays, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 4, minW: 2, minH: 2, maxW: 6, maxH: 6 },
        maxInstances: 1,
        allowedContexts: ['semester', 'course'],
    },
    {
        pluginId,
        type: 'habit-streak-ring',
        name: 'Habit Streak Ring',
        description: 'Track the same streak with the classic ring view and encouragement feedback.',
        icon: createElement(Flame, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 4, minW: 2, minH: 2, maxW: 6, maxH: 6 },
        maxInstances: 1,
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    widgetCatalog,
});
