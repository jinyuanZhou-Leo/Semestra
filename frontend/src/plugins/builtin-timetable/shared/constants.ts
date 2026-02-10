export const BUILTIN_TIMETABLE_TAB_TYPE = 'builtin-academic-timetable';

export const DEFAULT_WEEK = 1;
export const ALL_FILTER_VALUE = 'ALL';

export const SLOT_LOCATION_NOTE_PREFIX = '[loc] ';

export const DAY_OF_WEEK_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
] as const;

export const CALENDAR_DEFAULT_START_MINUTES = 8 * 60;
export const CALENDAR_DEFAULT_END_MINUTES = 20 * 60;
export const CALENDAR_MIN_EVENT_HEIGHT = 28;
export const CALENDAR_PIXEL_PER_MINUTE = 1.05;
export const CALENDAR_ROW_MIN_HEIGHT = 120;
export const CALENDAR_MAX_EVENT_LINES_PER_DAY = 3;

export const CALENDAR_EVENT_DEFAULT_COLORS = {
  schedule: '#3b82f6',
  todo: '#10b981',
  custom: '#8b5cf6',
} as const;

export const CALENDAR_DEFAULT_SKIPPED_DISPLAY = 'grayed';
export const CALENDAR_DEFAULT_VIEW_MODE = 'week';

export const SCHEDULE_CACHE_TTL_MS = 30_000;
export const SCHEDULE_MAX_PARALLEL_REQUESTS = 6;

export const EVENT_BUS_DEFAULT_DEBOUNCE_MS = 120;
export const EVENT_BUS_DEFAULT_DEDUPE_WINDOW_MS = 180;
