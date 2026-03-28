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
const pluginIcon = createElement(Flame, { className: 'h-4 w-4' });

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'habit-streak-duolingo',
        name: 'Habit Streak Duolingo',
        description: 'Track your streak with the Duolingo-style week board.',
        icon: createElement(CalendarDays, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 4, minW: 2, minH: 2, maxW: 6, maxH: 6 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
    {
        pluginId,
        type: 'habit-streak-ring',
        name: 'Habit Streak Ring',
        description: 'Track a streak with the classic ring view and encouragement feedback.',
        icon: createElement(Flame, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 4, minW: 2, minH: 2, maxW: 6, maxH: 6 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    displayName: 'Habit Streak',
    author: 'Jinyuan',
    description: 'Build consistency with simple daily streak tracking.',
    longDescription: 'Habit Streak helps users stay consistent with routines that matter during the semester, whether that means studying, reviewing notes, exercising, or keeping up with personal goals. It turns daily follow-through into a visible pattern, making momentum easier to notice and easier to protect. The experience is intentionally lightweight so habits feel easy to check, easy to maintain, and easy to fit into everyday academic life.',
    icon: pluginIcon,
    supportsUnassignedCourse: true,
    widgetCatalog,
});
