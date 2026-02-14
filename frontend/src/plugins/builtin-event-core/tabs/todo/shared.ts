import type { TodoPriorityOption, TodoSortOption } from './types';

export const TODO_SETTINGS_VERSION = 1;
export const COURSE_LIST_FALLBACK_NAME = 'Course List';
export const DEFAULT_SECTION_NAME = 'General';
export const COMPLETED_SECTION_ID = '__completed__';
export const COMPLETED_SECTION_NAME = 'Completed';
export const UNSECTIONED_TASK_BUCKET_ID = '__unsectioned__';
export const UNSECTIONED_TASK_BUCKET_NAME = 'No Section';
export const COMPLETED_MOVE_TIMEOUT_MS = 1500;

export const PRIORITY_OPTIONS: TodoPriorityOption[] = [
  { value: 'LOW', label: 'Low', className: 'bg-slate-100 text-slate-700 border-slate-200', weight: 1 },
  { value: 'MEDIUM', label: 'Medium', className: 'bg-blue-100 text-blue-700 border-blue-200', weight: 2 },
  { value: 'HIGH', label: 'High', className: 'bg-amber-100 text-amber-700 border-amber-200', weight: 3 },
  { value: 'URGENT', label: 'Urgent', className: 'bg-rose-100 text-rose-700 border-rose-200', weight: 4 },
];

export const SORT_OPTIONS: TodoSortOption[] = [
  { value: 'created', label: 'Created Order' },
  { value: 'due-date', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
];
