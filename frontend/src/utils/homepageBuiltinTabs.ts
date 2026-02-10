import {
    BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_SEMESTER_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
} from '../plugins/builtin-event-core/shared/constants';

export const HOMEPAGE_DASHBOARD_TAB_ID = 'dashboard';
export const HOMEPAGE_SETTINGS_TAB_ID = 'settings';

const BUILTIN_ACADEMIC_TIMETABLE_TAB_TYPE = 'builtin-academic-timetable';

export interface BuiltinHomepageTabDescriptor {
    id: string;
    fallbackLabel: string;
}

export interface HomepageBuiltinTabConfig {
    builtinTabIds: readonly string[];
    hiddenTabTypes: ReadonlySet<string>;
    builtinTabDescriptors: readonly BuiltinHomepageTabDescriptor[];
}

const buildHiddenTabTypes = (
    builtinTabIds: readonly string[],
    extraHiddenTabTypes: readonly string[]
): ReadonlySet<string> => {
    // Builtin tabs are rendered as fixed entries, so custom tab sections should hide them.
    return new Set<string>([...builtinTabIds, ...extraHiddenTabTypes]);
};

const SEMESTER_BUILTIN_TAB_IDS = [
    BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    BUILTIN_TIMETABLE_SEMESTER_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
] as const;

const COURSE_BUILTIN_TAB_IDS = [
    BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
] as const;

export const SEMESTER_HOMEPAGE_BUILTIN_TAB_CONFIG: HomepageBuiltinTabConfig = {
    builtinTabIds: SEMESTER_BUILTIN_TAB_IDS,
    hiddenTabTypes: buildHiddenTabTypes(SEMESTER_BUILTIN_TAB_IDS, [
        BUILTIN_ACADEMIC_TIMETABLE_TAB_TYPE,
        BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    ]),
    builtinTabDescriptors: [
        { id: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, fallbackLabel: 'Calendar' },
        { id: BUILTIN_TIMETABLE_SEMESTER_SCHEDULE_TAB_TYPE, fallbackLabel: 'Semester Schedule' },
        { id: BUILTIN_TIMETABLE_TODO_TAB_TYPE, fallbackLabel: 'Todo' },
    ],
};

export const COURSE_HOMEPAGE_BUILTIN_TAB_CONFIG: HomepageBuiltinTabConfig = {
    builtinTabIds: COURSE_BUILTIN_TAB_IDS,
    hiddenTabTypes: buildHiddenTabTypes(COURSE_BUILTIN_TAB_IDS, [
        BUILTIN_ACADEMIC_TIMETABLE_TAB_TYPE,
        BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
        BUILTIN_TIMETABLE_SEMESTER_SCHEDULE_TAB_TYPE,
    ]),
    builtinTabDescriptors: [
        { id: BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE, fallbackLabel: 'Course Schedule' },
        { id: BUILTIN_TIMETABLE_TODO_TAB_TYPE, fallbackLabel: 'Todo' },
    ],
};
