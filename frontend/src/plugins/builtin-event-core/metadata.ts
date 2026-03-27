// input:  [React icon factory, lucide icons, plugin metadata helpers, and built-in event contribution constants]
// output: [default-exported builtin-event-core plugin manifest plus tab/widget catalog declaration]
// pos:    [plugin manifest entry for the multi-surface academic events plugin]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { CalendarDays, Clock3, ListTodo, NotebookPen } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { TabCatalogItem, WidgetCatalogItem } from '../../plugin-system/types';
import {
    BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_TODAY_EVENTS_WIDGET_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
} from './shared/constants';

const pluginId = 'builtin-event-core';
const pluginIcon = createElement(CalendarDays, { className: 'h-4 w-4' });

const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
        name: 'Calendar',
        description: 'Semester calendar with schedule visualization',
        icon: pluginIcon,
        maxInstances: 0,
        allowedContexts: ['semester'],
    },
    {
        pluginId,
        type: BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
        name: 'Course Schedule',
        description: 'Manage course sections, event types, and recurring slot rules',
        icon: createElement(NotebookPen, { className: 'h-4 w-4' }),
        maxInstances: 0,
        allowedContexts: ['course'],
    },
    {
        pluginId,
        type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
        name: 'Todo',
        description: 'Context-aware todo lists with sections, priorities, and due scheduling',
        icon: createElement(ListTodo, { className: 'h-4 w-4' }),
        maxInstances: 0,
        allowedContexts: ['semester', 'course'],
    },
];

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: BUILTIN_TIMETABLE_TODAY_EVENTS_WIDGET_TYPE,
        name: 'Today Events',
        description: 'Quickly check active schedule events for today.',
        icon: createElement(Clock3, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
        maxInstances: 1,
        allowedContexts: ['semester', 'course'],
    },
];

export default definePluginMetadata({
    pluginId,
    icon: pluginIcon,
    tabCatalog,
    widgetCatalog,
});
