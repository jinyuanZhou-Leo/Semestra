import { createElement } from 'react';
import { CalendarDays, Clock3, ListTodo, NotebookPen } from 'lucide-react';
import type { TabCatalogItem, WidgetCatalogItem } from '../../plugin-system/types';
import {
    BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_TODAY_EVENTS_WIDGET_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
} from './shared/constants';

export const pluginId = 'builtin-event-core';

export const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
        name: 'Calendar',
        description: 'Semester calendar with schedule visualization',
        icon: createElement(CalendarDays, { className: 'h-4 w-4' }),
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

export const widgetCatalog: WidgetCatalogItem[] = [
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
