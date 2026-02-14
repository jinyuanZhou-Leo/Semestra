import type { Tab as ApiTab } from '@/services/api';
import {
  COMPLETED_SECTION_ID,
  COMPLETED_SECTION_NAME,
  DEFAULT_SECTION_NAME,
  PRIORITY_OPTIONS,
  TODO_SETTINGS_VERSION,
} from '../shared';
import type {
  SemesterCourseListState,
  SemesterCustomListStorage,
  TaskDraft,
  TodoListStorage,
  TodoPriority,
  TodoSection,
  TodoSortDirection,
  TodoSortMode,
  TodoTask,
} from '../types';

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const nowIso = () => new Date().toISOString();

export const makeId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
};

const readString = (value: unknown, fallback = '') => {
  if (typeof value === 'string') return value;
  return fallback;
};

const readBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  return fallback;
};

export const ensureTimeValue = (value: unknown) => {
  const raw = readString(value, '').trim();
  if (!raw) return '';
  const match = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const ensureDateValue = (value: unknown) => {
  const raw = readString(value, '').trim();
  if (!raw) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
};

export const completedSection = (order: number): TodoSection => ({
  id: COMPLETED_SECTION_ID,
  name: COMPLETED_SECTION_NAME,
  order,
  isSystem: true,
});

export const userSectionsOf = (sections: TodoSection[]) => {
  return sections.filter((section) => section.id !== COMPLETED_SECTION_ID);
};

const normalizeSections = (input: unknown): TodoSection[] => {
  const parsed = Array.isArray(input)
    ? input
      .map((item, index) => {
        if (!isRecord(item)) return null;
        const id = readString(item.id, '').trim();
        if (!id || id === COMPLETED_SECTION_ID) return null;

        const name = readString(item.name, DEFAULT_SECTION_NAME).trim() || DEFAULT_SECTION_NAME;
        const orderValue = typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : index;

        return {
          id,
          name,
          order: orderValue,
        } satisfies TodoSection;
      })
      .filter((item): item is TodoSection => item !== null)
    : [];

  const dedupedUserSections: TodoSection[] = [];
  const seenIds = new Set<string>();

  parsed
    .sort((a, b) => a.order - b.order)
    .forEach((section) => {
      if (seenIds.has(section.id)) return;
      seenIds.add(section.id);
      dedupedUserSections.push(section);
    });

  const normalizedUsers = dedupedUserSections.map((section, index) => ({
    ...section,
    order: index,
    isSystem: false,
  }));

  return [...normalizedUsers, completedSection(normalizedUsers.length)];
};

const normalizeTasks = (
  input: unknown,
  validSectionIds: Set<string>,
  validUserSectionIds: Set<string>,
  fallbackUserSectionId?: string,
): TodoTask[] => {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .map((item) => {
      if (!isRecord(item)) return null;

      const id = readString(item.id, makeId('task'));
      const title = readString(item.title, '').trim();
      if (!title) return null;

      const priorityValue = readString(item.priority, 'MEDIUM');
      const priority = PRIORITY_OPTIONS.some((option) => option.value === priorityValue as TodoPriority)
        ? (priorityValue as TodoPriority)
        : 'MEDIUM';

      const rawSectionId = readString(item.sectionId, '').trim();
      const safeSectionId = rawSectionId === COMPLETED_SECTION_ID
        ? COMPLETED_SECTION_ID
        : rawSectionId === ''
          ? ''
        : (validSectionIds.has(rawSectionId)
          ? rawSectionId
          : (fallbackUserSectionId ?? ''));
      const completed = safeSectionId === COMPLETED_SECTION_ID ? true : readBoolean(item.completed, false);

      const originSectionId = readString(item.originSectionId, '').trim();
      const safeOriginSectionId = validUserSectionIds.has(originSectionId) ? originSectionId : undefined;
      const orderValue = typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : Number.NaN;

      return {
        id,
        title,
        description: readString(item.description, ''),
        sectionId: safeSectionId,
        originSectionId: completed
          ? (safeOriginSectionId ?? (safeSectionId !== COMPLETED_SECTION_ID ? safeSectionId : fallbackUserSectionId))
          : undefined,
        dueDate: ensureDateValue(item.dueDate),
        dueTime: ensureTimeValue(item.dueTime),
        priority,
        completed,
        order: orderValue,
        createdAt: readString(item.createdAt, nowIso()),
        updatedAt: readString(item.updatedAt, nowIso()),
      } satisfies TodoTask;
    })
    .filter((item): item is TodoTask => item !== null);

  return normalized
    .sort((a, b) => {
      const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title);
    })
    .map((task, index) => ({
      ...task,
      order: index,
    }));
};

export const normalizeListStorage = (input: unknown): TodoListStorage => {
  const source = isRecord(input) ? input : {};
  const sections = normalizeSections(source.sections);
  const users = userSectionsOf(sections);
  const fallbackUserSectionId = users[0]?.id;
  const sectionIds = new Set(sections.map((section) => section.id));
  const userIds = new Set(users.map((section) => section.id));
  const tasks = normalizeTasks(source.tasks, sectionIds, userIds, fallbackUserSectionId);

  return {
    sections,
    tasks,
  };
};

export const normalizeSemesterCustomLists = (settings: Record<string, unknown>): SemesterCustomListStorage[] => {
  const rawLists = settings.semesterCustomLists;
  if (!Array.isArray(rawLists)) return [];

  return rawLists
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = readString(item.id, makeId('custom-list'));
      const name = readString(item.name, 'Untitled List').trim() || 'Untitled List';
      const normalized = normalizeListStorage(item);
      const createdAt = readString(item.createdAt, nowIso());
      const updatedAt = readString(item.updatedAt, createdAt);

      return {
        id,
        name,
        sections: normalized.sections,
        tasks: normalized.tasks,
        createdAt,
        updatedAt,
      } satisfies SemesterCustomListStorage;
    })
    .filter((item): item is SemesterCustomListStorage => item !== null);
};

export const parseJsonObject = (value: string | undefined): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const normalizeCourseListStateFromTab = (
  courseId: string,
  courseName: string,
  todoTab?: ApiTab,
): SemesterCourseListState => {
  const parsedSettings = parseJsonObject(todoTab?.settings);
  const listStorage = normalizeListStorage(isRecord(parsedSettings.courseList) ? parsedSettings.courseList : undefined);

  return {
    courseId,
    courseName,
    tabId: todoTab?.id,
    baseSettings: parsedSettings,
    sections: listStorage.sections,
    tasks: listStorage.tasks,
  };
};

export const serializeCourseSettings = (entry: SemesterCourseListState): Record<string, unknown> => {
  return {
    ...entry.baseSettings,
    version: TODO_SETTINGS_VERSION,
    courseList: {
      sections: entry.sections,
      tasks: entry.tasks,
    },
  };
};

export const createTaskDraft = (defaultSectionId: string): TaskDraft => ({
  title: '',
  description: '',
  sectionId: defaultSectionId,
  dueDate: '',
  dueTime: '',
  priority: 'MEDIUM',
});

export const getPriorityMeta = (priority: TodoPriority) => {
  return PRIORITY_OPTIONS.find((option) => option.value === priority) ?? PRIORITY_OPTIONS[1];
};

const priorityWeightOf = (priority: TodoPriority) => {
  return getPriorityMeta(priority).weight;
};

const dueWeight = (task: TodoTask) => {
  if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
  const date = new Date(`${task.dueDate}T${task.dueTime || '23:59'}:00`);
  return Number.isFinite(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
};

export const sortTasksForDisplay = (
  tasks: TodoTask[],
  isCompletedSection: boolean,
  sortMode: TodoSortMode,
  sortDirection: TodoSortDirection,
) => {
  const sorted = [...tasks].sort((a, b) => {
    if (sortMode === 'created') {
      return a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title);
    }

    if (sortMode === 'due-date') {
      const dueDiff = dueWeight(a) - dueWeight(b);
      return dueDiff !== 0 ? dueDiff : a.title.localeCompare(b.title);
    }

    if (sortMode === 'priority') {
      const priorityDiff = priorityWeightOf(b.priority) - priorityWeightOf(a.priority);
      return priorityDiff !== 0 ? priorityDiff : a.title.localeCompare(b.title);
    }

    if (sortMode === 'title') {
      return a.title.localeCompare(b.title);
    }

    if (isCompletedSection) {
      return b.updatedAt.localeCompare(a.updatedAt) || b.title.localeCompare(a.title);
    }

    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    if (!a.completed && !b.completed) {
      const dueDiff = dueWeight(a) - dueWeight(b);
      if (dueDiff !== 0) return dueDiff;
      const priorityDiff = priorityWeightOf(b.priority) - priorityWeightOf(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
    }

    return a.title.localeCompare(b.title);
  });

  if (sortDirection === 'desc') {
    sorted.reverse();
  }

  return sorted;
};

export const formatTaskDue = (task: TodoTask) => {
  if (!task.dueDate && !task.dueTime) return 'No due date';
  if (!task.dueDate) return `At ${task.dueTime}`;
  if (!task.dueTime) return task.dueDate;
  return `${task.dueDate} ${task.dueTime}`;
};

export const createSectionName = (storage: TodoListStorage) => {
  const existing = new Set(userSectionsOf(storage.sections).map((section) => section.name.toLowerCase()));
  let index = userSectionsOf(storage.sections).length + 1;
  let next = `Section ${index}`;

  while (existing.has(next.toLowerCase())) {
    index += 1;
    next = `Section ${index}`;
  }

  return next;
};

export const listTimerKey = (listId: string, taskId: string) => `${listId}:${taskId}`;
