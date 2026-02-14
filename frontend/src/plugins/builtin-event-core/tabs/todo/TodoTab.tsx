import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Flag,
  ListTree,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import api, { type Course, type Tab as ApiTab } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BUILTIN_TIMETABLE_TODO_TAB_TYPE } from '../../shared/constants';
import { normalizeTodoBehaviorSettings } from './preferences';

const TODO_SETTINGS_VERSION = 1;
const COURSE_LIST_FALLBACK_NAME = 'Course List';
const DEFAULT_SECTION_NAME = 'General';
const COMPLETED_SECTION_ID = '__completed__';
const COMPLETED_SECTION_NAME = 'Completed';
const UNSECTIONED_TASK_BUCKET_ID = '__unsectioned__';
const UNSECTIONED_TASK_BUCKET_NAME = 'No Section';
const COMPLETED_MOVE_TIMEOUT_MS = 1500;

type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type TodoListSource = 'course' | 'semester-custom';

interface TodoSection {
  id: string;
  name: string;
  order: number;
  isSystem?: boolean;
}

interface TodoTask {
  id: string;
  title: string;
  description: string;
  sectionId: string;
  originSectionId: string | undefined;
  dueDate: string;
  dueTime: string;
  priority: TodoPriority;
  completed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface TodoListStorage {
  sections: TodoSection[];
  tasks: TodoTask[];
}

interface SemesterCustomListStorage extends TodoListStorage {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface TodoListModel extends TodoListStorage {
  id: string;
  name: string;
  source: TodoListSource;
  editableName: boolean;
  courseId?: string;
}

interface SemesterCourseListState extends TodoListStorage {
  courseId: string;
  courseName: string;
  tabId?: string;
  baseSettings: Record<string, unknown>;
}

interface TaskDraft {
  title: string;
  description: string;
  sectionId: string;
  dueDate: string;
  dueTime: string;
  priority: TodoPriority;
}

interface TodoTabProps {
  settings: unknown;
  updateSettings: (nextSettings: unknown) => void | Promise<void>;
  courseId?: string;
  semesterId?: string;
}

type TodoSortMode = 'created' | 'due-date' | 'priority' | 'title';

const PRIORITY_OPTIONS: Array<{ value: TodoPriority; label: string; className: string; weight: number }> = [
  { value: 'LOW', label: 'Low', className: 'bg-slate-100 text-slate-700 border-slate-200', weight: 1 },
  { value: 'MEDIUM', label: 'Medium', className: 'bg-blue-100 text-blue-700 border-blue-200', weight: 2 },
  { value: 'HIGH', label: 'High', className: 'bg-amber-100 text-amber-700 border-amber-200', weight: 3 },
  { value: 'URGENT', label: 'Urgent', className: 'bg-rose-100 text-rose-700 border-rose-200', weight: 4 },
];

const SORT_OPTIONS: Array<{ value: TodoSortMode; label: string }> = [
  { value: 'created', label: 'Created Order' },
  { value: 'due-date', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) => {
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

const ensureTimeValue = (value: unknown) => {
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

const ensureDateValue = (value: unknown) => {
  const raw = readString(value, '').trim();
  if (!raw) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
};

const completedSection = (order: number): TodoSection => ({
  id: COMPLETED_SECTION_ID,
  name: COMPLETED_SECTION_NAME,
  order,
  isSystem: true,
});

const userSectionsOf = (sections: TodoSection[]) => sections.filter((section) => section.id !== COMPLETED_SECTION_ID);

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

const normalizeListStorage = (input: unknown): TodoListStorage => {
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

const normalizeSemesterCustomLists = (settings: Record<string, unknown>): SemesterCustomListStorage[] => {
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

const parseJsonObject = (value: string | undefined): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeCourseListStateFromTab = (
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

const serializeCourseSettings = (entry: SemesterCourseListState): Record<string, unknown> => {
  return {
    ...entry.baseSettings,
    version: TODO_SETTINGS_VERSION,
    courseList: {
      sections: entry.sections,
      tasks: entry.tasks,
    },
  };
};

const createTaskDraft = (defaultSectionId: string): TaskDraft => ({
  title: '',
  description: '',
  sectionId: defaultSectionId,
  dueDate: '',
  dueTime: '',
  priority: 'MEDIUM',
});

const getPriorityMeta = (priority: TodoPriority) => {
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

const sortTasksForDisplay = (tasks: TodoTask[], isCompletedSection: boolean, sortMode: TodoSortMode) => {
  return [...tasks].sort((a, b) => {
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
};

const formatTaskDue = (task: TodoTask) => {
  if (!task.dueDate && !task.dueTime) return 'No due date';
  if (!task.dueDate) return `At ${task.dueTime}`;
  if (!task.dueTime) return task.dueDate;
  return `${task.dueDate} ${task.dueTime}`;
};

const createSectionName = (storage: TodoListStorage) => {
  const existing = new Set(userSectionsOf(storage.sections).map((section) => section.name.toLowerCase()));
  let index = userSectionsOf(storage.sections).length + 1;
  let next = `Section ${index}`;

  while (existing.has(next.toLowerCase())) {
    index += 1;
    next = `Section ${index}`;
  }

  return next;
};

const listTimerKey = (listId: string, taskId: string) => `${listId}:${taskId}`;

export const TodoTab: React.FC<TodoTabProps> = ({ settings, updateSettings, courseId, semesterId }) => {
  const mode: 'course' | 'semester' | 'unsupported' = courseId
    ? 'course'
    : semesterId
      ? 'semester'
      : 'unsupported';

  const safeSettings = React.useMemo<Record<string, unknown>>(() => {
    return isRecord(settings) ? settings : {};
  }, [settings]);

  const behavior = React.useMemo(() => normalizeTodoBehaviorSettings(safeSettings), [safeSettings]);
  const shouldAutoMoveCompleted = behavior.moveCompletedToCompletedSection;

  const [courseDisplayName, setCourseDisplayName] = React.useState(COURSE_LIST_FALLBACK_NAME);
  const [selectedListId, setSelectedListId] = React.useState('');
  const [sectionOpenMap, setSectionOpenMap] = React.useState<Record<string, boolean>>({});

  const [listTitleDialogOpen, setListTitleDialogOpen] = React.useState(false);
  const [listTitleDraft, setListTitleDraft] = React.useState('');
  const [sectionTitleDialogOpen, setSectionTitleDialogOpen] = React.useState(false);
  const [sectionTitleDraft, setSectionTitleDraft] = React.useState('');
  const [sectionTitleTargetId, setSectionTitleTargetId] = React.useState<string | null>(null);

  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [taskDialogEditingId, setTaskDialogEditingId] = React.useState<string | null>(null);
  const [taskDraft, setTaskDraft] = React.useState<TaskDraft>(createTaskDraft(UNSECTIONED_TASK_BUCKET_ID));
  const [listManageMode, setListManageMode] = React.useState(false);
  const [deleteListDialogOpen, setDeleteListDialogOpen] = React.useState(false);
  const [deleteListTarget, setDeleteListTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [sortMode, setSortMode] = React.useState<TodoSortMode>('created');
  const [draggingTaskId, setDraggingTaskId] = React.useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = React.useState<string | null>(null);

  const [semesterCourseLists, setSemesterCourseLists] = React.useState<Record<string, SemesterCourseListState>>({});
  const [semesterCourseListsLoading, setSemesterCourseListsLoading] = React.useState(false);

  const loadRequestIdRef = React.useRef(0);
  const syncTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSyncRef = React.useRef<Map<string, SemesterCourseListState>>(new Map());
  const inflightSyncRef = React.useRef<Set<string>>(new Set());
  const completedMoveTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const updateLocalSettings = React.useCallback((nextSettings: Record<string, unknown>) => {
    void updateSettings(nextSettings);
  }, [updateSettings]);

  const courseListStorage = React.useMemo<TodoListStorage>(() => {
    return normalizeListStorage(isRecord(safeSettings.courseList) ? safeSettings.courseList : undefined);
  }, [safeSettings]);

  const semesterCustomLists = React.useMemo(() => {
    return normalizeSemesterCustomLists(safeSettings);
  }, [safeSettings]);

  React.useEffect(() => {
    if (!courseId) {
      setCourseDisplayName(COURSE_LIST_FALLBACK_NAME);
      return;
    }

    let cancelled = false;

    api.getCourse(courseId)
      .then((course) => {
        if (cancelled) return;
        setCourseDisplayName(course.name?.trim() || COURSE_LIST_FALLBACK_NAME);
      })
      .catch(() => {
        if (cancelled) return;
        setCourseDisplayName(COURSE_LIST_FALLBACK_NAME);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  React.useEffect(() => {
    if (mode !== 'semester') {
      setListManageMode(false);
    }
  }, [mode]);

  const updateCourseListInCurrentTab = React.useCallback(
    (updater: (current: TodoListStorage) => TodoListStorage) => {
      const nextStorage = normalizeListStorage(updater(courseListStorage));
      updateLocalSettings({
        ...safeSettings,
        version: TODO_SETTINGS_VERSION,
        courseList: nextStorage,
      });
    },
    [courseListStorage, safeSettings, updateLocalSettings],
  );

  const updateSemesterCustomLists = React.useCallback(
    (updater: (current: SemesterCustomListStorage[]) => SemesterCustomListStorage[]) => {
      const nextLists = updater(semesterCustomLists);
      updateLocalSettings({
        ...safeSettings,
        version: TODO_SETTINGS_VERSION,
        semesterCustomLists: nextLists,
      });
    },
    [semesterCustomLists, safeSettings, updateLocalSettings],
  );

  const flushCourseListSync = React.useCallback(async (targetCourseId: string) => {
    if (inflightSyncRef.current.has(targetCourseId)) return;
    inflightSyncRef.current.add(targetCourseId);

    try {
      while (pendingSyncRef.current.has(targetCourseId)) {
        const pending = pendingSyncRef.current.get(targetCourseId);
        if (!pending) break;
        pendingSyncRef.current.delete(targetCourseId);

        let tabId = pending.tabId;
        let baseSettings = pending.baseSettings;

        if (!tabId) {
          const created = await api.createTabForCourse(targetCourseId, {
            tab_type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
            title: 'Todo',
            settings: JSON.stringify(serializeCourseSettings(pending)),
          });

          tabId = created.id;
          baseSettings = parseJsonObject(created.settings);

          setSemesterCourseLists((previous) => {
            const current = previous[targetCourseId];
            if (!current) return previous;

            return {
              ...previous,
              [targetCourseId]: {
                ...current,
                tabId,
                baseSettings,
              },
            };
          });

          continue;
        }

        const updated = await api.updateTab(tabId, {
          settings: JSON.stringify({
            ...baseSettings,
            version: TODO_SETTINGS_VERSION,
            courseList: {
              sections: pending.sections,
              tasks: pending.tasks,
            },
          }),
        });

        const updatedSettings = parseJsonObject(updated.settings);
        const normalized = normalizeListStorage(
          isRecord(updatedSettings.courseList) ? updatedSettings.courseList : undefined,
        );

        setSemesterCourseLists((previous) => {
          const current = previous[targetCourseId];
          if (!current) return previous;

          return {
            ...previous,
            [targetCourseId]: {
              ...current,
              tabId,
              baseSettings: updatedSettings,
              sections: normalized.sections,
              tasks: normalized.tasks,
            },
          };
        });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to save course todo list.');
    } finally {
      inflightSyncRef.current.delete(targetCourseId);
      if (pendingSyncRef.current.has(targetCourseId)) {
        void flushCourseListSync(targetCourseId);
      }
    }
  }, []);

  const queueCourseListSync = React.useCallback((entry: SemesterCourseListState) => {
    pendingSyncRef.current.set(entry.courseId, entry);

    const previousTimer = syncTimersRef.current.get(entry.courseId);
    if (previousTimer) clearTimeout(previousTimer);

    const nextTimer = setTimeout(() => {
      syncTimersRef.current.delete(entry.courseId);
      void flushCourseListSync(entry.courseId);
    }, 350);

    syncTimersRef.current.set(entry.courseId, nextTimer);
  }, [flushCourseListSync]);

  const updateSemesterCourseList = React.useCallback(
    (targetCourseId: string, updater: (current: TodoListStorage) => TodoListStorage) => {
      setSemesterCourseLists((previous) => {
        const current = previous[targetCourseId];
        if (!current) return previous;

        const nextStorage = normalizeListStorage(updater({ sections: current.sections, tasks: current.tasks }));
        const nextEntry: SemesterCourseListState = {
          ...current,
          sections: nextStorage.sections,
          tasks: nextStorage.tasks,
        };

        queueCourseListSync(nextEntry);

        return {
          ...previous,
          [targetCourseId]: nextEntry,
        };
      });
    },
    [queueCourseListSync],
  );

  React.useEffect(() => {
    if (mode !== 'semester' || !semesterId) return;

    let cancelled = false;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setSemesterCourseListsLoading(true);

    const load = async () => {
      try {
        const semester = await api.getSemester(semesterId);
        const courses = (semester.courses ?? []) as Course[];

        const details = await Promise.all(
          courses.map(async (course) => {
            try {
              const detail = await api.getCourse(course.id);
              return { course, detail };
            } catch {
              return { course, detail: undefined };
            }
          }),
        );

        if (cancelled || loadRequestIdRef.current !== requestId) return;

        const nextState: Record<string, SemesterCourseListState> = {};
        details.forEach(({ course, detail }) => {
          const todoTab = detail?.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
          nextState[course.id] = normalizeCourseListStateFromTab(course.id, course.name, todoTab);
        });

        setSemesterCourseLists(nextState);
      } catch (error: any) {
        if (cancelled || loadRequestIdRef.current !== requestId) return;
        toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to load semester todo lists.');
      } finally {
        if (!cancelled && loadRequestIdRef.current === requestId) {
          setSemesterCourseListsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      loadRequestIdRef.current += 1;
    };
  }, [mode, semesterId]);

  React.useEffect(() => {
    const syncTimers = syncTimersRef.current;
    return () => {
      syncTimers.forEach((timer) => clearTimeout(timer));
      syncTimers.clear();
    };
  }, []);

  const clearTaskMoveTimer = React.useCallback((listId: string, taskId: string) => {
    const key = listTimerKey(listId, taskId);
    const timer = completedMoveTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      completedMoveTimersRef.current.delete(key);
    }
  }, []);

  const clearAllTaskMoveTimers = React.useCallback(() => {
    completedMoveTimersRef.current.forEach((timer) => clearTimeout(timer));
    completedMoveTimersRef.current.clear();
  }, []);

  React.useEffect(() => {
    if (!shouldAutoMoveCompleted) {
      clearAllTaskMoveTimers();
    }
  }, [clearAllTaskMoveTimers, shouldAutoMoveCompleted]);

  React.useEffect(() => {
    return () => {
      clearAllTaskMoveTimers();
    };
  }, [clearAllTaskMoveTimers]);

  const courseModeList = React.useMemo<TodoListModel | null>(() => {
    if (!courseId) return null;

    return {
      id: `course:${courseId}`,
      name: courseDisplayName,
      source: 'course',
      editableName: false,
      courseId,
      sections: courseListStorage.sections,
      tasks: courseListStorage.tasks,
    };
  }, [courseDisplayName, courseId, courseListStorage]);

  const semesterCourseModels = React.useMemo<TodoListModel[]>(() => {
    return Object.values(semesterCourseLists)
      .sort((a, b) => a.courseName.localeCompare(b.courseName))
      .map((entry) => ({
        id: `course:${entry.courseId}`,
        name: entry.courseName,
        source: 'course',
        editableName: false,
        courseId: entry.courseId,
        sections: entry.sections,
        tasks: entry.tasks,
      }));
  }, [semesterCourseLists]);

  const semesterCustomModels = React.useMemo<TodoListModel[]>(() => {
    return semesterCustomLists.map((list) => ({
      id: list.id,
      name: list.name,
      source: 'semester-custom',
      editableName: true,
      sections: list.sections,
      tasks: list.tasks,
    }));
  }, [semesterCustomLists]);

  const allLists = React.useMemo<TodoListModel[]>(() => {
    if (mode === 'course') {
      return courseModeList ? [courseModeList] : [];
    }

    if (mode === 'semester') {
      return [...semesterCourseModels, ...semesterCustomModels];
    }

    return [];
  }, [mode, courseModeList, semesterCourseModels, semesterCustomModels]);

  React.useEffect(() => {
    if (allLists.length === 0) {
      if (selectedListId !== '') setSelectedListId('');
      return;
    }

    if (!allLists.some((list) => list.id === selectedListId)) {
      setSelectedListId(allLists[0].id);
    }
  }, [allLists, selectedListId]);

  const activeList = React.useMemo(() => {
    if (allLists.length === 0) return null;
    return allLists.find((list) => list.id === selectedListId) ?? allLists[0];
  }, [allLists, selectedListId]);

  React.useEffect(() => {
    setDraggingTaskId(null);
    setDragOverSectionId(null);
  }, [activeList?.id]);

  React.useEffect(() => {
    if (!sectionTitleDialogOpen || !activeList || !sectionTitleTargetId) return;
    const exists = activeList.sections.some((section) => section.id === sectionTitleTargetId);
    if (!exists) {
      setSectionTitleDialogOpen(false);
      setSectionTitleTargetId(null);
    }
  }, [activeList, sectionTitleDialogOpen, sectionTitleTargetId]);

  const mutateListStorage = React.useCallback(
    (list: TodoListModel, updater: (current: TodoListStorage) => TodoListStorage) => {
      if (list.source === 'course') {
        if (mode === 'course') {
          updateCourseListInCurrentTab(updater);
          return;
        }

        if (list.courseId) {
          updateSemesterCourseList(list.courseId, updater);
        }

        return;
      }

      updateSemesterCustomLists((currentLists) => {
        return currentLists.map((item) => {
          if (item.id !== list.id) return item;
          const nextStorage = normalizeListStorage(updater({ sections: item.sections, tasks: item.tasks }));
          return {
            ...item,
            sections: nextStorage.sections,
            tasks: nextStorage.tasks,
            updatedAt: nowIso(),
          };
        });
      });
    },
    [mode, updateCourseListInCurrentTab, updateSemesterCourseList, updateSemesterCustomLists],
  );

  const scheduleMoveToCompleted = React.useCallback((list: TodoListModel, taskId: string) => {
    if (!shouldAutoMoveCompleted) return;

    clearTaskMoveTimer(list.id, taskId);

    const key = listTimerKey(list.id, taskId);
    const timer = setTimeout(() => {
      completedMoveTimersRef.current.delete(key);

      mutateListStorage(list, (current) => {
        const targetTask = current.tasks.find((task) => task.id === taskId);
        if (!targetTask || !targetTask.completed || targetTask.sectionId === COMPLETED_SECTION_ID) {
          return current;
        }

        return {
          ...current,
          tasks: current.tasks.map((task) => {
            if (task.id !== taskId) return task;
            return {
              ...task,
              sectionId: COMPLETED_SECTION_ID,
              originSectionId: task.originSectionId ?? (task.sectionId || undefined),
              updatedAt: nowIso(),
            };
          }),
        };
      });
    }, COMPLETED_MOVE_TIMEOUT_MS);

    completedMoveTimersRef.current.set(key, timer);
  }, [clearTaskMoveTimer, mutateListStorage, shouldAutoMoveCompleted]);

  const handleCreateCustomList = React.useCallback(() => {
    if (mode !== 'semester') return;

    const completed = completedSection(0);

    const createdAt = nowIso();
    const nextList: SemesterCustomListStorage = {
      id: makeId('custom-list'),
      name: `Custom List ${semesterCustomLists.length + 1}`,
      sections: [completed],
      tasks: [],
      createdAt,
      updatedAt: createdAt,
    };

    updateSemesterCustomLists((current) => [...current, nextList]);
    setSelectedListId(nextList.id);
  }, [mode, semesterCustomLists.length, updateSemesterCustomLists]);

  const handleDeleteCustomList = React.useCallback((listId: string) => {
    updateSemesterCustomLists((current) => current.filter((item) => item.id !== listId));
    if (selectedListId === listId) {
      setSelectedListId('');
    }
  }, [selectedListId, updateSemesterCustomLists]);

  const openDeleteListAlert = React.useCallback((list: TodoListModel) => {
    if (list.source !== 'semester-custom') return;
    setDeleteListTarget({ id: list.id, name: list.name });
    setDeleteListDialogOpen(true);
  }, []);

  const confirmDeleteCustomList = React.useCallback(() => {
    if (!deleteListTarget) return;
    handleDeleteCustomList(deleteListTarget.id);
    setDeleteListDialogOpen(false);
    setDeleteListTarget(null);
  }, [deleteListTarget, handleDeleteCustomList]);

  const handleRenameList = React.useCallback((list: TodoListModel, nextName: string) => {
    if (!list.editableName) return;

    updateSemesterCustomLists((current) => {
      return current.map((item) => {
        if (item.id !== list.id) return item;
        return {
          ...item,
          name: nextName,
          updatedAt: nowIso(),
        };
      });
    });
  }, [updateSemesterCustomLists]);

  const handleAddSection = React.useCallback((list: TodoListModel) => {
    mutateListStorage(list, (current) => {
      const users = userSectionsOf(current.sections);
      const nextSection: TodoSection = {
        id: makeId('section'),
        name: createSectionName(current),
        order: users.length,
        isSystem: false,
      };
      const nextUsers = [...users, nextSection].map((section, index) => ({ ...section, order: index, isSystem: false }));

      return {
        ...current,
        sections: [...nextUsers, completedSection(nextUsers.length)],
      };
    });
  }, [mutateListStorage]);

  const handleRenameSection = React.useCallback((list: TodoListModel, sectionId: string, nextName: string) => {
    if (sectionId === COMPLETED_SECTION_ID) return;

    mutateListStorage(list, (current) => {
      const trimmed = nextName.trim();
      const safeName = trimmed || DEFAULT_SECTION_NAME;

      const nextUsers = userSectionsOf(current.sections)
        .map((section) => (section.id === sectionId ? { ...section, name: safeName } : section))
        .map((section, index) => ({ ...section, order: index, isSystem: false }));

      return {
        ...current,
        sections: [...nextUsers, completedSection(nextUsers.length)],
      };
    });
  }, [mutateListStorage]);

  const openListTitleEditor = React.useCallback((list: TodoListModel) => {
    if (!list.editableName) return;
    setListTitleDraft(list.name);
    setListTitleDialogOpen(true);
  }, []);

  const saveListTitle = React.useCallback(() => {
    if (!activeList || !activeList.editableName) return;
    const nextTitle = listTitleDraft.trim() || 'Untitled List';
    handleRenameList(activeList, nextTitle);
    setListTitleDialogOpen(false);
  }, [activeList, handleRenameList, listTitleDraft]);

  const openSectionTitleEditor = React.useCallback((section: TodoSection) => {
    if (section.id === COMPLETED_SECTION_ID) return;
    setSectionTitleTargetId(section.id);
    setSectionTitleDraft(section.name);
    setSectionTitleDialogOpen(true);
  }, []);

  const saveSectionTitle = React.useCallback(() => {
    if (!activeList || !sectionTitleTargetId) return;
    const nextTitle = sectionTitleDraft.trim() || DEFAULT_SECTION_NAME;
    handleRenameSection(activeList, sectionTitleTargetId, nextTitle);
    setSectionTitleDialogOpen(false);
    setSectionTitleTargetId(null);
  }, [activeList, handleRenameSection, sectionTitleDraft, sectionTitleTargetId]);

  const handleDeleteSection = React.useCallback((list: TodoListModel, sectionId: string) => {
    if (sectionId === COMPLETED_SECTION_ID) return;

    mutateListStorage(list, (current) => {
      const users = userSectionsOf(current.sections);
      if (users.length === 0) {
        return current;
      }

      const nextUsers = users.filter((section) => section.id !== sectionId).map((section, index) => ({
        ...section,
        order: index,
        isSystem: false,
      }));
      const fallbackSectionId = nextUsers[0]?.id ?? '';

      return {
        sections: [...nextUsers, completedSection(nextUsers.length)],
        tasks: current.tasks.map((task) => {
          if (task.sectionId !== sectionId) return task;
          return {
            ...task,
            sectionId: task.completed && shouldAutoMoveCompleted ? COMPLETED_SECTION_ID : fallbackSectionId,
            originSectionId: task.completed ? (fallbackSectionId || undefined) : undefined,
            updatedAt: nowIso(),
          };
        }),
      };
    });
  }, [mutateListStorage, shouldAutoMoveCompleted]);

  const openCreateTaskDialog = React.useCallback((list: TodoListModel) => {
    const defaultSectionId = userSectionsOf(list.sections)[0]?.id ?? UNSECTIONED_TASK_BUCKET_ID;
    setTaskDialogEditingId(null);
    setTaskDraft(createTaskDraft(defaultSectionId));
    setTaskDialogOpen(true);
  }, []);

  const openEditTaskDialog = React.useCallback((list: TodoListModel, task: TodoTask) => {
    if (task.sectionId === COMPLETED_SECTION_ID) return;

    const userSections = userSectionsOf(list.sections);
    const fallbackSectionId = userSections[0]?.id ?? '';
    const effectiveSection = task.sectionId === COMPLETED_SECTION_ID
      ? (task.originSectionId && userSections.some((section) => section.id === task.originSectionId)
        ? task.originSectionId
        : fallbackSectionId)
      : task.sectionId;

    setTaskDialogEditingId(task.id);
    setTaskDraft({
      title: task.title,
      description: task.description,
      sectionId: effectiveSection || UNSECTIONED_TASK_BUCKET_ID,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      priority: task.priority,
    });
    setTaskDialogOpen(true);
  }, []);

  const handleSaveTask = React.useCallback((list: TodoListModel) => {
    const title = taskDraft.title.trim();
    if (!title) {
      toast.message('Task title is required.');
      return;
    }

    const userSections = userSectionsOf(list.sections);
    const safeSectionId = userSections.some((section) => section.id === taskDraft.sectionId)
      ? taskDraft.sectionId
      : '';

    mutateListStorage(list, (current) => {
      if (taskDialogEditingId) {
        return {
          ...current,
          tasks: current.tasks.map((task) => {
            if (task.id !== taskDialogEditingId) return task;

            const common = {
              ...task,
              title,
              description: taskDraft.description,
              dueDate: ensureDateValue(taskDraft.dueDate),
              dueTime: ensureTimeValue(taskDraft.dueTime),
              priority: taskDraft.priority,
              updatedAt: nowIso(),
            };

            if (task.completed && shouldAutoMoveCompleted) {
              return {
                ...common,
                sectionId: COMPLETED_SECTION_ID,
                originSectionId: safeSectionId || undefined,
              };
            }

            return {
              ...common,
              sectionId: safeSectionId,
              originSectionId: task.completed ? (safeSectionId || undefined) : undefined,
            };
          }),
        };
      }

      const createdAt = nowIso();
      const nextTask: TodoTask = {
        id: makeId('task'),
        title,
        description: taskDraft.description,
        sectionId: safeSectionId,
        originSectionId: undefined,
        dueDate: ensureDateValue(taskDraft.dueDate),
        dueTime: ensureTimeValue(taskDraft.dueTime),
        priority: taskDraft.priority,
        completed: false,
        order: current.tasks.length,
        createdAt,
        updatedAt: createdAt,
      };

      return {
        ...current,
        tasks: [...current.tasks, nextTask],
      };
    });

    setTaskDialogOpen(false);
    setTaskDialogEditingId(null);
  }, [mutateListStorage, shouldAutoMoveCompleted, taskDialogEditingId, taskDraft]);

  const handleToggleTaskCompleted = React.useCallback((list: TodoListModel, taskId: string, completed: boolean) => {
    if (!completed) {
      clearTaskMoveTimer(list.id, taskId);
    }

    mutateListStorage(list, (current) => {
      const users = userSectionsOf(current.sections);
      const fallbackSectionId = users[0]?.id ?? '';

      return {
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id !== taskId) return task;

          if (!completed) {
            const restoreSectionId = task.sectionId === COMPLETED_SECTION_ID
              ? (task.originSectionId && users.some((section) => section.id === task.originSectionId)
                ? task.originSectionId
                : fallbackSectionId)
              : task.sectionId;

            return {
              ...task,
              completed: false,
              sectionId: restoreSectionId,
              originSectionId: undefined,
              updatedAt: nowIso(),
            };
          }

          return {
            ...task,
            completed: true,
            originSectionId: task.sectionId === COMPLETED_SECTION_ID
              ? task.originSectionId
              : (task.originSectionId ?? (task.sectionId || undefined)),
            updatedAt: nowIso(),
          };
        }),
      };
    });

    if (completed && shouldAutoMoveCompleted) {
      scheduleMoveToCompleted(list, taskId);
    }
  }, [clearTaskMoveTimer, mutateListStorage, scheduleMoveToCompleted, shouldAutoMoveCompleted]);

  const handleDeleteTask = React.useCallback((list: TodoListModel, taskId: string) => {
    clearTaskMoveTimer(list.id, taskId);
    mutateListStorage(list, (current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  }, [clearTaskMoveTimer, mutateListStorage]);

  const handleTaskDrop = React.useCallback((
    list: TodoListModel,
    sourceTaskId: string,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => {
    mutateListStorage(list, (current) => {
      const ordered = [...current.tasks].sort((a, b) => a.order - b.order);
      const sourceIndex = ordered.findIndex((task) => task.id === sourceTaskId);
      if (sourceIndex < 0) return current;

      const sourceTask = ordered[sourceIndex];
      if (sourceTask.completed) return current;

      const nextTargetSectionId = targetSectionId === UNSECTIONED_TASK_BUCKET_ID ? '' : targetSectionId;
      if (nextTargetSectionId === COMPLETED_SECTION_ID) return current;
      const validSectionIds = new Set(current.sections.map((section) => section.id));
      if (nextTargetSectionId && !validSectionIds.has(nextTargetSectionId)) return current;

      const remaining = ordered.filter((task) => task.id !== sourceTaskId);

      let insertIndex = remaining.length;
      if (beforeTaskId) {
        const beforeIndex = remaining.findIndex((task) => task.id === beforeTaskId);
        insertIndex = beforeIndex >= 0 ? beforeIndex : remaining.length;
      } else {
        const lastIndexInTarget = (() => {
          for (let index = remaining.length - 1; index >= 0; index -= 1) {
            if (remaining[index].sectionId === nextTargetSectionId) return index;
          }
          return -1;
        })();
        insertIndex = lastIndexInTarget >= 0 ? lastIndexInTarget + 1 : remaining.length;
      }

      const movedTask: TodoTask = {
        ...sourceTask,
        sectionId: nextTargetSectionId,
        updatedAt: nowIso(),
      };

      const merged = [
        ...remaining.slice(0, insertIndex),
        movedTask,
        ...remaining.slice(insertIndex),
      ];

      return {
        ...current,
        tasks: merged.map((task, index) => ({ ...task, order: index })),
      };
    });
  }, [mutateListStorage]);

  const sectionTasksMap = React.useMemo(() => {
    if (!activeList) return new Map<string, TodoTask[]>();

    const map = new Map<string, TodoTask[]>();
    map.set(UNSECTIONED_TASK_BUCKET_ID, []);
    activeList.sections.forEach((section) => map.set(section.id, []));

    activeList.tasks.forEach((task) => {
      const bucket = map.get(task.sectionId) ?? map.get(UNSECTIONED_TASK_BUCKET_ID);
      if (!bucket) return;
      bucket.push(task);
    });

    map.forEach((tasks, sectionId) => {
      map.set(sectionId, sortTasksForDisplay(tasks, sectionId === COMPLETED_SECTION_ID, sortMode));
    });

    return map;
  }, [activeList, sortMode]);

  const sectionOpenKey = React.useCallback((listId: string, sectionId: string) => {
    return `${listId}:${sectionId}`;
  }, []);

  const isSectionOpen = React.useCallback((listId: string, sectionId: string) => {
    const key = sectionOpenKey(listId, sectionId);
    const fromState = sectionOpenMap[key];
    if (typeof fromState === 'boolean') return fromState;
    return sectionId !== COMPLETED_SECTION_ID;
  }, [sectionOpenKey, sectionOpenMap]);

  const setSectionOpen = React.useCallback((listId: string, sectionId: string, open: boolean) => {
    const key = sectionOpenKey(listId, sectionId);
    setSectionOpenMap((previous) => ({ ...previous, [key]: open }));
  }, [sectionOpenKey]);

  if (mode === 'unsupported') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Todo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Semester or course context is required.</p>
        </CardContent>
      </Card>
    );
  }

  const activeListUserSections = activeList ? userSectionsOf(activeList.sections) : [];
  const unsectionedTasks = activeList ? (sectionTasksMap.get(UNSECTIONED_TASK_BUCKET_ID) ?? []) : [];

  const handleTaskDragStart = (task: TodoTask) => {
    if (task.completed) return;
    setDraggingTaskId(task.id);
  };

  const handleTaskDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverSectionId(null);
  };

  const handleTaskDragOverSection = (
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
  ) => {
    if (!draggingTaskId) return;
    event.preventDefault();
    setDragOverSectionId(targetSectionId);
  };

  const handleTaskDropToSection = (
    event: React.DragEvent<HTMLElement>,
    list: TodoListModel,
    targetSectionId: string,
    beforeTaskId: string | null = null,
  ) => {
    event.preventDefault();
    if (!draggingTaskId) return;
    if (beforeTaskId && beforeTaskId === draggingTaskId) {
      setDraggingTaskId(null);
      setDragOverSectionId(null);
      return;
    }

    handleTaskDrop(list, draggingTaskId, targetSectionId, beforeTaskId);
    setDraggingTaskId(null);
    setDragOverSectionId(null);
  };

  const renderTaskCard = (list: TodoListModel, task: TodoTask, sectionId: string) => {
    const priorityMeta = getPriorityMeta(task.priority);
    const isCompletedSection = sectionId === COMPLETED_SECTION_ID;

    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        draggable={!task.completed}
        onDragStart={() => handleTaskDragStart(task)}
        onDragEnd={handleTaskDragEnd}
        onDragOver={(event) => handleTaskDragOverSection(event, sectionId)}
        onDrop={(event) => handleTaskDropToSection(event, list, sectionId, task.id)}
        className={cn(
          'rounded-md border px-3 py-2',
          task.completed ? 'border-border/50 bg-background/80' : 'border-border/70 bg-background',
          draggingTaskId === task.id && 'opacity-55',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Checkbox
              checked={task.completed}
              onCheckedChange={(checked) => handleToggleTaskCompleted(list, task.id, checked === true)}
              aria-label={`Mark ${task.title} as completed`}
            />

            <div className="min-w-0 space-y-1">
              <p
                className={cn(
                  'truncate text-sm font-medium',
                  task.completed && 'text-muted-foreground line-through',
                )}
              >
                {task.title}
              </p>

              {task.description ? (
                <p
                  className="overflow-hidden text-xs text-muted-foreground"
                  title={task.description}
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {task.description}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" className="text-[11px]">
                  <CalendarClock className="mr-1 h-3 w-3" />
                  {formatTaskDue(task)}
                </Badge>
                <Badge className={cn('border text-[11px]', priorityMeta.className)}>
                  <Flag className="mr-1 h-3 w-3" />
                  {priorityMeta.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!isCompletedSection ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openEditTaskDialog(list, task)}
                aria-label={`Edit ${task.title}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDeleteTask(list, task.id)}
              aria-label={`Delete ${task.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-[208px_minmax(0,1fr)] gap-0 md:grid-cols-[232px_minmax(0,1fr)] xl:min-w-0 xl:grid-cols-[244px_minmax(0,1fr)]">
            <div className="border-r px-2.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                <CardTitle className="text-sm">Lists</CardTitle>
                {mode === 'semester' ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant={listManageMode ? 'secondary' : 'outline'}
                      onClick={() => setListManageMode((previous) => !previous)}
                      aria-label={listManageMode ? 'Done editing lists' : 'Edit lists'}
                      title={listManageMode ? 'Done' : 'Edit'}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="outline"
                      onClick={handleCreateCustomList}
                      aria-label="Create new list"
                      title="New"
                    >
                      <CirclePlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
              {semesterCourseListsLoading && mode === 'semester' && allLists.length === 0 ? (
                <p className="mb-2 px-0.5 text-xs text-muted-foreground">Loading lists...</p>
              ) : null}
              <ScrollArea className="h-[560px]">
                <div className="space-y-1.5 pr-1">
                  {allLists.map((list) => {
                    const isActive = activeList?.id === list.id;
                    const total = list.tasks.length;
                    const completed = list.tasks.filter((task) => task.completed).length;
                    const isCustomList = list.source === 'semester-custom';
                    const canDeleteList = listManageMode && isCustomList;

                    return (
                      <div key={list.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setSelectedListId(list.id)}
                          className={cn(
                            'w-full rounded-md border px-2 py-1.5 text-left transition-colors',
                            isCustomList && 'pr-8',
                            isActive
                              ? 'border-primary/45 bg-primary/5'
                              : 'border-border/60 hover:border-border hover:bg-muted/35',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium leading-tight">{list.name}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {completed}/{total} completed
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {list.source === 'course' ? (
                                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                  Course
                                </Badge>
                              ) : null}
                              {!list.editableName ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
                            </div>
                          </div>
                        </button>

                        {isCustomList ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className={cn(
                              'absolute right-1 top-1 text-destructive transition-opacity hover:bg-destructive/10 hover:text-destructive',
                              canDeleteList ? 'opacity-100' : 'pointer-events-none opacity-0',
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteListAlert(list);
                            }}
                            aria-label={`Delete list ${list.name}`}
                            title="Delete list"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                  {allLists.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">No lists yet.</p>
                  ) : null}
                </div>
              </ScrollArea>
            </div>

            <div className="px-4 py-3">
            {activeList ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="truncate text-xl leading-9">{activeList.name}</CardTitle>
                    {activeList.editableName ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openListTitleEditor(activeList)}
                        aria-label={`Edit title for ${activeList.name}`}
                        title="Edit list title"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="icon" aria-label="Open task options">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={sortMode}
                        onValueChange={(value) => setSortMode(value as TodoSortMode)}
                      >
                        {SORT_OPTIONS.map((option) => (
                          <DropdownMenuRadioItem key={option.value} value={option.value}>
                            {option.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button type="button" variant="outline" onClick={() => handleAddSection(activeList)}>
                    <ListTree className="mr-2 h-4 w-4" />
                    Add Section
                  </Button>
                  <Button type="button" onClick={() => openCreateTaskDialog(activeList)}>
                    <CirclePlus className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-b pb-4">
                <CardTitle className="text-xl leading-9">Todo</CardTitle>
              </div>
            )}

            <div className="pt-4">
              {!activeList ? (
                <p className="text-sm text-muted-foreground">No list available.</p>
              ) : (
                <ScrollArea className="h-[560px]">
                  <div className="space-y-3 pr-2">
                    <motion.div
                      layout
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className={cn(
                        'rounded-md border px-1.5 py-1',
                        dragOverSectionId === UNSECTIONED_TASK_BUCKET_ID && 'border-primary/60',
                      )}
                      onDragOver={(event) => handleTaskDragOverSection(event, UNSECTIONED_TASK_BUCKET_ID)}
                      onDrop={(event) => handleTaskDropToSection(event, activeList, UNSECTIONED_TASK_BUCKET_ID, null)}
                    >
                      <div className="flex items-center gap-1.5 px-1 py-1">
                        <p className="truncate text-sm font-medium">{UNSECTIONED_TASK_BUCKET_NAME}</p>
                        <Badge variant="outline" className="shrink-0 text-[11px]">{unsectionedTasks.length}</Badge>
                      </div>
                      <div className="space-y-1.5 px-7 pb-2 pt-1">
                        {unsectionedTasks.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-muted-foreground">No tasks</p>
                        ) : (
                          <AnimatePresence initial={false}>
                            {unsectionedTasks.map((task) => renderTaskCard(activeList, task, UNSECTIONED_TASK_BUCKET_ID))}
                          </AnimatePresence>
                        )}
                      </div>
                    </motion.div>

                    {activeList.sections.map((section) => {
                      const tasks = sectionTasksMap.get(section.id) ?? [];
                      const isCompletedSection = section.id === COMPLETED_SECTION_ID;
                      const isOpen = isSectionOpen(activeList.id, section.id);
                      const canDeleteSection = !isCompletedSection && activeListUserSections.length > 0;

                      return (
                        <motion.div
                          key={section.id}
                          layout
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                        >
                          <Collapsible
                            open={isOpen}
                            onOpenChange={(open) => setSectionOpen(activeList.id, section.id, open)}
                          >
                          <motion.div
                            layout
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            onDragOver={(event) => handleTaskDragOverSection(event, section.id)}
                            onDrop={(event) => handleTaskDropToSection(event, activeList, section.id, null)}
                            className={cn(
                              'rounded-md border px-1.5 py-1',
                              isCompletedSection ? 'border-border/60 opacity-85' : 'border-border/55',
                              dragOverSectionId === section.id && 'border-primary/60',
                            )}
                          >
                            <div className="flex items-center gap-2 px-1 py-1">
                              <CollapsibleTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="hover:bg-transparent dark:hover:bg-transparent aria-expanded:bg-transparent"
                                  aria-label={`Toggle ${section.name}`}
                                >
                                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>

                              <div className="min-w-0 flex flex-1 items-center gap-1.5">
                                {isCompletedSection ? (
                                  <p className="truncate text-sm font-medium text-muted-foreground">{section.name}</p>
                                ) : (
                                  <p className="truncate text-sm font-medium">{section.name}</p>
                                )}
                                <Badge variant="outline" className="shrink-0 text-[11px]">{tasks.length}</Badge>
                              </div>

                              {!isCompletedSection ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openSectionTitleEditor(section)}
                                  aria-label={`Edit section ${section.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              ) : null}

                              {canDeleteSection ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handleDeleteSection(activeList, section.id)}
                                    aria-label={`Delete section ${section.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : null}
                            </div>

                            <CollapsibleContent className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
                              <div
                                className="space-y-1.5 px-7 pb-2 pt-1"
                                onDragOver={(event) => handleTaskDragOverSection(event, section.id)}
                                onDrop={(event) => handleTaskDropToSection(event, activeList, section.id, null)}
                              >
                                {tasks.length === 0 ? (
                                  <p className="px-2 py-1 text-xs text-muted-foreground">No tasks</p>
                                ) : (
                                  <AnimatePresence initial={false}>
                                    {tasks.map((task) => renderTaskCard(activeList, task, section.id))}
                                  </AnimatePresence>
                                )}
                              </div>
                            </CollapsibleContent>
                          </motion.div>
                          </Collapsible>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
            </div>
          </div>
        </div>
      </Card>

      <AlertDialog
        open={deleteListDialogOpen}
        onOpenChange={(open) => {
          setDeleteListDialogOpen(open);
          if (!open) {
            setDeleteListTarget(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. List{' '}
              <span className="font-medium text-foreground">
                {deleteListTarget?.name ?? ''}
              </span>{' '}
              and its tasks will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteCustomList}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={listTitleDialogOpen}
        onOpenChange={(open) => setListTitleDialogOpen(open)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit List Title</DialogTitle>
            <DialogDescription>Update the list title.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="todo-list-title-edit">Title</Label>
            <Input
              id="todo-list-title-edit"
              value={listTitleDraft}
              onChange={(event) => setListTitleDraft(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setListTitleDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveListTitle}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sectionTitleDialogOpen}
        onOpenChange={(open) => {
          setSectionTitleDialogOpen(open);
          if (!open) {
            setSectionTitleTargetId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Section Title</DialogTitle>
            <DialogDescription>Update the section title.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="todo-section-title-edit">Title</Label>
            <Input
              id="todo-section-title-edit"
              value={sectionTitleDraft}
              onChange={(event) => setSectionTitleDraft(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSectionTitleDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveSectionTitle}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setTaskDialogEditingId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{taskDialogEditingId ? 'Edit Task' : 'Create Task'}</DialogTitle>
            <DialogDescription>Set task details, schedule, and priority.</DialogDescription>
          </DialogHeader>

          {activeList ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="todo-task-title">Title</Label>
                <Input
                  id="todo-task-title"
                  value={taskDraft.title}
                  onChange={(event) => setTaskDraft((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="todo-task-description">Description</Label>
                <Textarea
                  id="todo-task-description"
                  value={taskDraft.description}
                  onChange={(event) => setTaskDraft((prev) => ({ ...prev, description: event.target.value }))}
                  className="max-h-32 resize-none overflow-y-auto"
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label>Section</Label>
                <Select
                  value={taskDraft.sectionId || UNSECTIONED_TASK_BUCKET_ID}
                  onValueChange={(value) => setTaskDraft((prev) => ({ ...prev, sectionId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSECTIONED_TASK_BUCKET_ID}>
                      {UNSECTIONED_TASK_BUCKET_NAME}
                    </SelectItem>
                    {activeListUserSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="todo-task-date">Date</Label>
                  <Input
                    id="todo-task-date"
                    type="date"
                    value={taskDraft.dueDate}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="todo-task-time">Time</Label>
                  <Input
                    id="todo-task-time"
                    type="time"
                    value={taskDraft.dueTime}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, dueTime: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={taskDraft.priority}
                  onValueChange={(value) => setTaskDraft((prev) => ({ ...prev, priority: value as TodoPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!activeList) return;
                handleSaveTask(activeList);
              }}
            >
              {taskDialogEditingId ? 'Save Changes' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
