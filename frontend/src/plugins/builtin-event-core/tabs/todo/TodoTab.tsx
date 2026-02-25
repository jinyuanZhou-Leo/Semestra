"use no memo";

import React from 'react';
import { toast } from 'sonner';
import api, { type Course } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BUILTIN_TIMETABLE_TODO_TAB_TYPE } from '../../shared/constants';
import { TodoListSidebar } from './components/TodoListSidebar';
import { TodoMainHeader } from './components/TodoMainHeader';
import { TodoSectionBlock } from './components/TodoSectionBlock';
import { TodoTaskCard } from './components/TodoTaskCard';
import { TodoUnsectionedBlock } from './components/TodoUnsectionedBlock';
import { TodoDeleteListAlert } from './components/dialogs/TodoDeleteListAlert';
import { TodoListTitleDialog } from './components/dialogs/TodoListTitleDialog';
import { TodoSectionTitleDialog } from './components/dialogs/TodoSectionTitleDialog';
import { TodoTaskDialog } from './components/dialogs/TodoTaskDialog';
import { useTodoSectionOpenMap } from './hooks/useTodoSectionOpenMap';
import { useTodoSectionTasks } from './hooks/useTodoSectionTasks';
import { useTodoTaskDrag } from './hooks/useTodoTaskDrag';
import { useTodoLists } from './hooks/useTodoLists';
import { normalizeTodoBehaviorSettings } from './preferences';
import {
  COMPLETED_MOVE_TIMEOUT_MS,
  COMPLETED_SECTION_ID,
  COURSE_LIST_FALLBACK_NAME,
  DEFAULT_SECTION_NAME,
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  TODO_SETTINGS_VERSION,
  UNSECTIONED_TASK_BUCKET_ID,
  UNSECTIONED_TASK_BUCKET_NAME,
} from './shared';
import type {
  SemesterCourseListState,
  SemesterCustomListStorage,
  TaskDraft,
  TodoListModel,
  TodoListStorage,
  TodoSection,
  TodoSortDirection,
  TodoSortMode,
  TodoTabMode,
  TodoTask,
} from './types';
import {
  createSectionName,
  createTaskDraft,
  ensureDateValue,
  ensureTimeValue,
  formatTaskDue,
  getPriorityMeta,
  isRecord,
  listTimerKey,
  makeId,
  normalizeCourseListStateFromTab,
  normalizeListStorage,
  normalizeSemesterCustomLists,
  nowIso,
  parseJsonObject,
  serializeCourseSettings,
  userSectionsOf,
  completedSection,
} from './utils/todoData';

interface TodoTabProps {
  settings: unknown;
  updateSettings: (nextSettings: unknown) => void | Promise<void>;
  courseId?: string;
  semesterId?: string;
}

export const TodoTab: React.FC<TodoTabProps> = ({ settings, updateSettings, courseId, semesterId }) => {
  const mode: TodoTabMode = courseId
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
  const [sortDirection, setSortDirection] = React.useState<TodoSortDirection>('asc');

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

  const {
    selectedListId,
    setSelectedListId,
    allLists,
    activeList,
  } = useTodoLists({
    mode,
    courseId,
    courseDisplayName,
    courseListStorage,
    semesterCourseLists,
    semesterCustomLists,
  });

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
  }, [mode, semesterCustomLists.length, setSelectedListId, updateSemesterCustomLists]);

  const handleDeleteCustomList = React.useCallback((listId: string) => {
    updateSemesterCustomLists((current) => current.filter((item) => item.id !== listId));
    if (selectedListId === listId) {
      setSelectedListId('');
    }
  }, [selectedListId, setSelectedListId, updateSemesterCustomLists]);

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

  const { isSectionOpen, setSectionOpen } = useTodoSectionOpenMap();

  const {
    sectionTasksMap,
    activeListUserSections,
    unsectionedTasks,
  } = useTodoSectionTasks({ activeList, sortMode, sortDirection });

  const {
    draggingTaskId,
    dragOverSectionId,
    resetTaskDragState,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleTaskDragOverSection,
    handleTaskDropToSection,
  } = useTodoTaskDrag({ onTaskDrop: handleTaskDrop });

  React.useEffect(() => {
    resetTaskDragState();
  }, [activeList?.id, resetTaskDragState]);

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

  const renderTaskCard = (list: TodoListModel, task: TodoTask, sectionId: string) => {
    return (
      <TodoTaskCard
        key={task.id}
        task={task}
        sectionId={sectionId}
        completedSectionId={COMPLETED_SECTION_ID}
        draggingTaskId={draggingTaskId}
        onTaskDragStart={handleTaskDragStart}
        onTaskDragEnd={handleTaskDragEnd}
        onTaskDragOverSection={handleTaskDragOverSection}
        onTaskDropToSection={(event, targetSectionId, beforeTaskId) => handleTaskDropToSection(event, list, targetSectionId, beforeTaskId)}
        onToggleTaskCompleted={(taskId, completed) => handleToggleTaskCompleted(list, taskId, completed)}
        onOpenEditTaskDialog={(currentTask) => openEditTaskDialog(list, currentTask)}
        onDeleteTask={(taskId) => handleDeleteTask(list, taskId)}
        getPriorityMeta={getPriorityMeta}
        formatTaskDue={formatTaskDue}
      />
    );
  };

  const showListSidebar = mode === 'semester';

  return (
    <div className="space-y-4 select-none">
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className={showListSidebar
            ? 'grid min-w-[720px] grid-cols-[208px_minmax(0,1fr)] gap-0 md:grid-cols-[232px_minmax(0,1fr)] xl:min-w-0 xl:grid-cols-[244px_minmax(0,1fr)]'
            : ''
          }>
            {showListSidebar ? (
              <TodoListSidebar
                mode={mode}
                listManageMode={listManageMode}
                semesterCourseListsLoading={semesterCourseListsLoading}
                allLists={allLists}
                activeListId={activeList?.id}
                onToggleListManageMode={() => setListManageMode((previous) => !previous)}
                onCreateCustomList={handleCreateCustomList}
                onSelectList={setSelectedListId}
                onOpenDeleteListAlert={openDeleteListAlert}
              />
            ) : null}

            <div className="px-4 py-3">
              <TodoMainHeader
                activeList={activeList}
                sortMode={sortMode}
                sortDirection={sortDirection}
                sortOptions={SORT_OPTIONS}
                onSortModeChange={setSortMode}
                onSortDirectionChange={setSortDirection}
                onOpenListTitleEditor={openListTitleEditor}
                onAddSection={handleAddSection}
                onOpenCreateTaskDialog={openCreateTaskDialog}
              />

              <div className="pt-4">
                {!activeList ? (
                  <p className="text-sm text-muted-foreground">No list available.</p>
                ) : (
                  <ScrollArea className="h-[560px]">
                    <div className="space-y-3 pr-2">
                      <TodoUnsectionedBlock
                        sectionId={UNSECTIONED_TASK_BUCKET_ID}
                        tasks={unsectionedTasks}
                        dragOverSectionId={dragOverSectionId}
                        onDragOverSection={handleTaskDragOverSection}
                        onDropToSection={(event, targetSectionId, beforeTaskId) => handleTaskDropToSection(
                          event,
                          activeList,
                          targetSectionId,
                          beforeTaskId,
                        )}
                        renderTaskCard={(task, sectionId) => renderTaskCard(activeList, task, sectionId)}
                      />

                      {activeList.sections.map((section) => {
                        const tasks = sectionTasksMap.get(section.id) ?? [];
                        const isOpen = isSectionOpen(activeList.id, section.id);
                        const canDeleteSection = section.id !== COMPLETED_SECTION_ID && activeListUserSections.length > 0;

                        return (
                          <TodoSectionBlock
                            key={section.id}
                            section={section}
                            tasks={tasks}
                            completedSectionId={COMPLETED_SECTION_ID}
                            isOpen={isOpen}
                            canDeleteSection={canDeleteSection}
                            dragOverSectionId={dragOverSectionId}
                            onOpenChange={(open) => setSectionOpen(activeList.id, section.id, open)}
                            onDragOverSection={handleTaskDragOverSection}
                            onDropToSection={(event, targetSectionId, beforeTaskId) => handleTaskDropToSection(event, activeList, targetSectionId, beforeTaskId)}
                            onOpenSectionTitleEditor={openSectionTitleEditor}
                            onDeleteSection={(sectionId) => handleDeleteSection(activeList, sectionId)}
                            renderTaskCard={(task, sectionId) => renderTaskCard(activeList, task, sectionId)}
                          />
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TodoDeleteListAlert
        open={deleteListDialogOpen}
        listName={deleteListTarget?.name ?? ''}
        onOpenChange={(open) => {
          setDeleteListDialogOpen(open);
          if (!open) {
            setDeleteListTarget(null);
          }
        }}
        onConfirmDelete={confirmDeleteCustomList}
      />

      <TodoListTitleDialog
        open={listTitleDialogOpen}
        titleDraft={listTitleDraft}
        onOpenChange={setListTitleDialogOpen}
        onTitleDraftChange={setListTitleDraft}
        onSave={saveListTitle}
      />

      <TodoSectionTitleDialog
        open={sectionTitleDialogOpen}
        titleDraft={sectionTitleDraft}
        onOpenChange={(open) => {
          setSectionTitleDialogOpen(open);
          if (!open) {
            setSectionTitleTargetId(null);
          }
        }}
        onTitleDraftChange={setSectionTitleDraft}
        onSave={saveSectionTitle}
      />

      <TodoTaskDialog
        open={taskDialogOpen}
        editingTaskId={taskDialogEditingId}
        taskDraft={taskDraft}
        sections={activeListUserSections}
        unsectionedBucketId={UNSECTIONED_TASK_BUCKET_ID}
        unsectionedBucketName={UNSECTIONED_TASK_BUCKET_NAME}
        priorityOptions={PRIORITY_OPTIONS}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setTaskDialogEditingId(null);
        }}
        onTaskDraftChange={setTaskDraft}
        onSave={() => {
          if (!activeList) return;
          handleSaveTask(activeList);
        }}
      />
    </div>
  );
};
