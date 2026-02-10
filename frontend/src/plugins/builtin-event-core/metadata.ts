import { createElement } from 'react';
import { CalendarDays, CalendarRange, ListTodo, NotebookPen } from 'lucide-react';
import type { TabCatalogItem } from '../../plugin-system/types';
import {
    BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_SEMESTER_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
} from './shared/constants';

export const pluginId = 'builtin-event-core';

export const tabCatalog: TabCatalogItem[] = [
    {
        pluginId,
        type: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
        name: 'Calendar',
        description: 'Semester calendar with FullCalendar-based schedule visualization',
        icon: createElement(CalendarDays, { className: 'h-4 w-4' }),
        maxInstances: 0,
        allowedContexts: ['semester'],
    },
    {
        pluginId,
        type: BUILTIN_TIMETABLE_SEMESTER_SCHEDULE_TAB_TYPE,
        name: 'Semester Schedule',
        description: 'Semester-level schedule filtering, conflict inspection, and exports',
        icon: createElement(CalendarRange, { className: 'h-4 w-4' }),
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
        description: 'Todo integration surface reserved for the upcoming phase',
        icon: createElement(ListTodo, { className: 'h-4 w-4' }),
        maxInstances: 0,
        allowedContexts: ['semester', 'course'],
    },
];
