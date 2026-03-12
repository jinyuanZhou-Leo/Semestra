// input:  [Todo API records, legacy todo settings payloads, shared constants, and todo domain types]
// output: [todo normalization, API-to-runtime mapping, formatting, and id/timestamp helper utilities]
// pos:    [Todo data utility layer that shapes persisted semester todo payloads into runtime-safe UI state while keeping a narrow legacy fallback parser]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { Tab as ApiTab, TodoSemesterStateRecord } from '@/services/api';
import {
  COMPLETED_SECTION_ID,
  COMPLETED_SECTION_NAME,
  DEFAULT_SECTION_NAME,
  PRIORITY_OPTIONS,
  SEMESTER_TODO_SETTINGS_KEY,
  TODO_SETTINGS_VERSION,
} from '../shared';
import type {
  TaskDraft,
  TodoCourseOption,
  TodoListStorage,
  TodoPriority,
  TodoSection,
  TodoSortDirection,
  TodoSortMode,
  TodoTask,
  TodoSemesterState,
} from '../types';

type CourseSnapshot = {
  courseId: string;
  courseName: string;
  courseCategory: string;
  courseColor: string;
  todoTab?: ApiTab;
};

type LegacyCustomListStorage = {
  id: string;
  name: string;
  sections: TodoSection[];
  tasks: TodoTask[];
};

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

export const parseJsonObject = (value: string | undefined): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
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
  const parsed: TodoSection[] = [];
  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      if (!isRecord(item)) return;
      const id = readString(item.id, '').trim();
      if (!id || id === COMPLETED_SECTION_ID) return;
      const name = readString(item.name, DEFAULT_SECTION_NAME).trim() || DEFAULT_SECTION_NAME;
      const orderValue = typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : index;
      parsed.push({
        id,
        name,
        order: orderValue,
        isSystem: false,
      });
    });
  }

  const seenIds = new Set<string>();
  const users = parsed
    .sort((a, b) => a.order - b.order)
    .filter((section) => {
      if (seenIds.has(section.id)) return false;
      seenIds.add(section.id);
      return true;
    })
    .map((section, index) => ({ ...section, order: index, isSystem: false }));

  return [...users, completedSection(users.length)];
};

const normalizeTasks = (
  input: unknown,
  validSectionIds: Set<string>,
  validUserSectionIds: Set<string>,
  fallbackUserSectionId: string | undefined,
  courseOptionsById: Map<string, TodoCourseOption>,
  defaultCourse?: TodoCourseOption,
): TodoTask[] => {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .map((item) => {
      if (!isRecord(item)) return null;

      const id = readString(item.id, makeId('task'));
      const title = readString(item.title, '').trim();
      if (!title) return null;

      const priorityValue = readString(item.priority, '');
      const priority = priorityValue === ''
        ? ''
        : PRIORITY_OPTIONS.some((option) => option.value === priorityValue as TodoPriority)
        ? (priorityValue as TodoPriority)
        : '';

      const rawSectionId = readString(item.sectionId, '').trim();
      const safeSectionId = rawSectionId === COMPLETED_SECTION_ID
        ? COMPLETED_SECTION_ID
        : rawSectionId === ''
          ? ''
          : (validSectionIds.has(rawSectionId) ? rawSectionId : (fallbackUserSectionId ?? ''));
      const completed = safeSectionId === COMPLETED_SECTION_ID ? true : readBoolean(item.completed, false);

      const rawOriginSectionId = readString(item.originSectionId, '').trim();
      const safeOriginSectionId = validUserSectionIds.has(rawOriginSectionId) ? rawOriginSectionId : undefined;
      const rawCourseId = readString(item.courseId, defaultCourse?.id ?? '').trim();
      const matchedCourse = rawCourseId ? courseOptionsById.get(rawCourseId) : undefined;
      const courseId = matchedCourse?.id ?? defaultCourse?.id ?? rawCourseId;
      const courseName = matchedCourse?.name ?? readString(item.courseName, defaultCourse?.name ?? '').trim();
      const courseCategory = matchedCourse?.category ?? readString(item.courseCategory, defaultCourse?.category ?? '').trim();
      const orderValue = typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : Number.NaN;

      return {
        id,
        title,
        note: readString(item.note, readString(item.description, '')),
        sectionId: safeSectionId,
        originSectionId: completed
          ? (safeSectionId === COMPLETED_SECTION_ID ? safeOriginSectionId : (safeOriginSectionId ?? safeSectionId))
          : undefined,
        courseId,
        courseName,
        courseCategory,
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

export const normalizeListStorage = (
  input: unknown,
  courseOptions: TodoCourseOption[] = [],
  defaultCourse?: TodoCourseOption,
): TodoListStorage => {
  const source = isRecord(input) ? input : {};
  const sections = normalizeSections(source.sections);
  const users = userSectionsOf(sections);
  const fallbackUserSectionId = users[0]?.id;
  const sectionIds = new Set(sections.map((section) => section.id));
  const userIds = new Set(users.map((section) => section.id));
  const courseOptionsById = new Map(courseOptions.map((course) => [course.id, course]));
  const tasks = normalizeTasks(source.tasks, sectionIds, userIds, fallbackUserSectionId, courseOptionsById, defaultCourse);

  return {
    sections,
    tasks,
  };
};

const normalizeLegacySemesterCustomLists = (
  settings: Record<string, unknown>,
  courseOptions: TodoCourseOption[],
): LegacyCustomListStorage[] => {
  const rawLists = settings.semesterCustomLists;
  if (!Array.isArray(rawLists)) return [];

  return rawLists
    .map((item) => {
      if (!isRecord(item)) return null;
      const normalized = normalizeListStorage(item, courseOptions);
      return {
        id: readString(item.id, makeId('legacy-custom')),
        name: readString(item.name, 'Imported').trim() || 'Imported',
        sections: normalized.sections,
        tasks: normalized.tasks,
      } satisfies LegacyCustomListStorage;
    })
    .filter((item): item is LegacyCustomListStorage => item !== null);
};

const normalizeLegacyCourseStorage = (
  todoTab: ApiTab | undefined,
  course: TodoCourseOption,
): TodoListStorage => {
  const parsedSettings = parseJsonObject(todoTab?.settings);
  return normalizeListStorage(
    isRecord(parsedSettings.courseList) ? parsedSettings.courseList : undefined,
    [course],
    course,
  );
};

const migrateLegacyTodoState = (
  semesterSettings: Record<string, unknown>,
  courseSnapshots: CourseSnapshot[],
  courseOptions: TodoCourseOption[],
): TodoSemesterState => {
  const sectionEntries: TodoSection[] = [];
  const sectionIdsByLegacyKey = new Map<string, string>();

  const getOrCreateSectionId = (name: string) => {
    const normalizedName = name.trim() || DEFAULT_SECTION_NAME;
    const existingKey = normalizedName.toLowerCase();
    const existing = sectionEntries.find((section) => section.name.toLowerCase() === existingKey);
    if (existing) return existing.id;
    const id = makeId('section');
    sectionEntries.push({
      id,
      name: normalizedName,
      order: sectionEntries.length,
      isSystem: false,
    });
    return id;
  };

  const courseTasks = courseSnapshots.flatMap((course) => {
    const legacyStorage = normalizeLegacyCourseStorage(course.todoTab, {
      id: course.courseId,
      name: course.courseName,
      category: course.courseCategory,
      color: course.courseColor,
    });

    return legacyStorage.tasks.map((task, index) => ({
      ...task,
      courseId: course.courseId,
      courseName: course.courseName,
      courseCategory: course.courseCategory,
      sectionId: task.completed ? COMPLETED_SECTION_ID : '',
      originSectionId: task.completed ? undefined : task.originSectionId,
      order: index,
    }));
  });

  const migratedCustomTasks = normalizeLegacySemesterCustomLists(semesterSettings, courseOptions).flatMap((list) => {
    const userSections = userSectionsOf(list.sections);
    const fallbackSectionId = getOrCreateSectionId(list.name);

    userSections.forEach((section) => {
      sectionIdsByLegacyKey.set(`${list.id}:${section.id}`, getOrCreateSectionId(`${list.name} · ${section.name}`));
    });

    return list.tasks.map((task) => {
      const mappedSectionId = task.completed
        ? COMPLETED_SECTION_ID
        : task.sectionId
          ? (sectionIdsByLegacyKey.get(`${list.id}:${task.sectionId}`) ?? fallbackSectionId)
          : fallbackSectionId;

      return {
        ...task,
        sectionId: mappedSectionId,
        originSectionId: task.completed
          ? mappedSectionId === COMPLETED_SECTION_ID ? fallbackSectionId : mappedSectionId
          : undefined,
        courseId: task.courseId,
        courseName: task.courseName,
        courseCategory: task.courseCategory,
      };
    });
  });

  const sections = [...sectionEntries.map((section, index) => ({ ...section, order: index })), completedSection(sectionEntries.length)];
  const tasks = [...courseTasks, ...migratedCustomTasks]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title))
    .map((task, index) => ({
      ...task,
      sectionId: task.completed ? COMPLETED_SECTION_ID : (sections.some((section) => section.id === task.sectionId) ? task.sectionId : ''),
      order: index,
    }));

  return {
    sections,
    tasks,
    courseOptions,
  };
};

export const normalizeSemesterTodoState = (
  settings: Record<string, unknown>,
  courseSnapshots: CourseSnapshot[],
): TodoSemesterState => {
  const courseOptions = courseSnapshots.map((course) => ({
    id: course.courseId,
    name: course.courseName,
    category: course.courseCategory,
    color: course.courseColor,
  }));
  const source = isRecord(settings[SEMESTER_TODO_SETTINGS_KEY]) ? settings[SEMESTER_TODO_SETTINGS_KEY] : null;

  if (source) {
    const normalized = normalizeListStorage(source, courseOptions);
    return {
      ...normalized,
      courseOptions,
    };
  }

  return migrateLegacyTodoState(settings, courseSnapshots, courseOptions);
};

export const normalizeCourseMirrorState = (
  settings: Record<string, unknown>,
  course: TodoCourseOption,
  fallbackSections: TodoSection[],
): TodoListStorage => {
  const normalized = normalizeListStorage(
    isRecord(settings.courseList) ? settings.courseList : undefined,
    [course],
    course,
  );
  const sections = userSectionsOf(normalized.sections).length > 0 ? normalized.sections : fallbackSections;
  return {
    sections,
    tasks: normalized.tasks
      .filter((task) => task.courseId === course.id || task.courseId === '')
      .map((task) => ({
        ...task,
        courseId: course.id,
        courseName: course.name,
        courseCategory: course.category,
      })),
  };
};

export const serializeSemesterTodoSettings = (
  baseSettings: Record<string, unknown>,
  storage: TodoListStorage,
) => ({
  ...baseSettings,
  version: TODO_SETTINGS_VERSION,
  [SEMESTER_TODO_SETTINGS_KEY]: {
    sections: storage.sections,
    tasks: storage.tasks,
  },
});

export const serializeCourseTodoSettings = (
  baseSettings: Record<string, unknown>,
  storage: TodoListStorage,
) => ({
  ...baseSettings,
  version: TODO_SETTINGS_VERSION,
  courseList: {
    sections: storage.sections,
    tasks: storage.tasks,
  },
});

export const buildCourseMirrorStorage = (
  semesterStorage: TodoListStorage,
  course: TodoCourseOption,
): TodoListStorage => ({
  sections: semesterStorage.sections,
  tasks: semesterStorage.tasks
    .filter((task) => task.courseId === course.id)
    .map((task, index) => ({
      ...task,
      courseId: course.id,
      courseName: course.name,
      courseCategory: course.category,
      order: index,
    })),
});

export const createTaskDraft = (
  sectionId = '',
  courseId = '',
): TaskDraft => ({
  title: '',
  note: '',
  sectionId,
  courseId,
  dueDate: '',
  dueTime: '',
  priority: '',
});

export const fromTodoApiState = (
  state: TodoSemesterStateRecord,
  moveCompletedToCompletedSection: boolean,
): TodoSemesterState => {
  const sections = [
    ...state.sections
      .sort((a, b) => a.order_index - b.order_index)
      .map((section, index) => ({
        id: section.id,
        name: section.name,
        order: index,
        isSystem: false,
      })),
    completedSection(state.sections.length),
  ];
  const validSectionIds = new Set(sections.map((section) => section.id));

  const tasks = state.tasks
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((task, index) => {
      const baseSectionId = task.section_id ?? '';
      const safeSectionId = baseSectionId && validSectionIds.has(baseSectionId) ? baseSectionId : '';
      const originSectionId = task.origin_section_id ?? (task.completed ? safeSectionId || undefined : undefined);
      const runtimeSectionId = task.completed && moveCompletedToCompletedSection
        ? COMPLETED_SECTION_ID
        : safeSectionId;

      return {
        id: task.id,
        title: task.title,
        note: task.note ?? '',
        sectionId: runtimeSectionId,
        originSectionId,
        courseId: task.course_id ?? '',
        courseName: task.course_name,
        courseCategory: task.course_category,
        dueDate: task.due_date ?? '',
        dueTime: task.due_time ?? '',
        priority: task.priority,
        completed: task.completed,
        order: index,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      } satisfies TodoTask;
    });

  return {
    sections,
    tasks,
    courseOptions: state.course_options.map((course) => ({
      id: course.id,
      name: course.name,
      category: course.category,
      color: course.color ?? '',
    })),
  };
};

export const getPriorityMeta = (priority: TodoPriority) => {
  return PRIORITY_OPTIONS.find((option) => option.value === priority) ?? null;
};

const priorityWeightOf = (priority: TodoPriority) => {
  return getPriorityMeta(priority)?.weight ?? 0;
};

const dueWeight = (task: TodoTask) => {
  if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
  const iso = `${task.dueDate}T${task.dueTime || '23:59'}:00`;
  const timestamp = new Date(iso).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

export const sortTasksForDisplay = (
  tasks: TodoTask[],
  isCompletedSection: boolean,
  sortMode: TodoSortMode,
  sortDirection: TodoSortDirection,
) => {
  const direction = sortDirection === 'asc' ? 1 : -1;

  return [...tasks].sort((a, b) => {
    if (!isCompletedSection && a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    switch (sortMode) {
      case 'due-date': {
        const result = dueWeight(a) - dueWeight(b);
        if (result !== 0) return result * direction;
        break;
      }
      case 'priority': {
        const result = priorityWeightOf(a.priority) - priorityWeightOf(b.priority);
        if (result !== 0) return result * direction;
        break;
      }
      case 'title': {
        const result = a.title.localeCompare(b.title);
        if (result !== 0) return result * direction;
        break;
      }
      case 'created':
      default: {
        const result = a.order - b.order;
        if (result !== 0) return result * direction;
        break;
      }
    }

    return a.createdAt.localeCompare(b.createdAt);
  });
};

export const formatTaskDue = (task: TodoTask) => {
  if (!task.dueDate) return 'No Date';
  return task.dueTime ? `${task.dueDate} ${task.dueTime}` : task.dueDate;
};

export const createSectionName = (storage: TodoListStorage) => {
  const nextIndex = userSectionsOf(storage.sections).length + 1;
  return `Section ${nextIndex}`;
};
