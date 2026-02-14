"use no memo";

import {
    BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
} from '../plugins/builtin-event-core/shared/constants';

export const HOMEPAGE_DASHBOARD_TAB_TYPE = 'dashboard';
export const HOMEPAGE_SETTINGS_TAB_TYPE = 'settings';

export interface HomepageBuiltinTabConfig {
    builtinTabTypes: readonly string[];
    trailingBuiltinTabTypes?: readonly string[];
}

const SEMESTER_BUILTIN_TAB_IDS = [
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
] as const;

const COURSE_BUILTIN_TAB_IDS = [
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    BUILTIN_TIMETABLE_TODO_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
] as const;

export const SEMESTER_HOMEPAGE_BUILTIN_TAB_CONFIG: HomepageBuiltinTabConfig = {
    builtinTabTypes: SEMESTER_BUILTIN_TAB_IDS,
    trailingBuiltinTabTypes: [HOMEPAGE_SETTINGS_TAB_TYPE],
};

export const COURSE_HOMEPAGE_BUILTIN_TAB_CONFIG: HomepageBuiltinTabConfig = {
    builtinTabTypes: COURSE_BUILTIN_TAB_IDS,
    trailingBuiltinTabTypes: [HOMEPAGE_SETTINGS_TAB_TYPE],
};
