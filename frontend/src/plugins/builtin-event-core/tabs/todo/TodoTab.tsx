// input:  [Todo tab settings payload, semester/course APIs, synchronized todo data helpers, shared UI primitives, and event bus refresh signals]
// output: [TodoTab React component for semester-first Apple Reminder-style todo management with mirrored course sync]
// pos:    [Todo tab orchestration layer that loads semester aggregate state, mirrors course-specific task snapshots, drives task/section mutations, and renders the unified list UI]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import { getCourseCategoryBadgeClassName } from '@/utils/courseCategoryBadge';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BUILTIN_TIMETABLE_TODO_TAB_TYPE } from '../../shared/constants';
import { timetableEventBus, useEventBus } from '../../shared/eventBus';
import { TodoInlineCreateRow } from './components/TodoInlineCreateRow';
import { TodoMainHeader } from './components/TodoMainHeader';
import { TodoSectionBlock } from './components/TodoSectionBlock';
import { TodoTaskCard } from './components/TodoTaskCard';
import { TodoUnsectionedBlock } from './components/TodoUnsectionedBlock';
import { TodoSectionTitleDialog } from './components/dialogs/TodoSectionTitleDialog';
import { TodoTaskDialog } from './components/dialogs/TodoTaskDialog';
import { useTodoSectionOpenMap } from './hooks/useTodoSectionOpenMap';
import { useTodoSectionTasks } from './hooks/useTodoSectionTasks';
import { useTodoTaskDrag } from './hooks/useTodoTaskDrag';
import { normalizeTodoBehaviorSettings } from './preferences';
import {
  COMPLETED_SECTION_ID,
  DEFAULT_SECTION_NAME,
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  UNSECTIONED_TASK_BUCKET_ID,
  UNSECTIONED_TASK_BUCKET_NAME,
} from './shared';
import type {
  TaskDraft,
  TodoCourseOption,
  TodoListModel,
  TodoListStorage,
  TodoSection,
  TodoSortDirection,
  TodoSortMode,
  TodoTabMode,
  TodoTask,
} from './types';
import {
  buildCourseMirrorStorage,
  completedSection,
  createSectionName,
  createTaskDraft,
  ensureDateValue,
  ensureTimeValue,
  formatTaskDue,
  getPriorityMeta,
  isRecord,
  makeId,
  normalizeListStorage,
  normalizeSemesterTodoState,
  nowIso,
  parseJsonObject,
  serializeCourseTodoSettings,
  serializeSemesterTodoSettings,
  userSectionsOf,
} from './utils/todoData';
import { toggleTodoTaskCompletedInStorage } from './utils/todoMutations';

interface TodoTabProps {
  settings: unknown;
  updateSettings: (nextSettings: unknown) => void | Promise<void>;
  courseId?: string;
  semesterId?: string;
}

interface SemesterTabMeta {
  tabId?: string;
  baseSettings: Record<string, unknown>;
}

interface CourseMirrorMeta {
  tabId?: string;
  baseSettings: Record<string, unknown>;
  course: TodoCourseOption;
}

const TodoMainPanelSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 pt-1">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-4 w-48 rounded-full opacity-70" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={`todo-row-skeleton-${index}`} className="h-24 rounded-[28px]" />
      ))}
    </div>
  );
};

export const TodoTab: React.FC<TodoTabProps> = ({ settings, semesterId, courseId }) => {
  const mode: TodoTabMode = courseId
    ? 'course'
    : semesterId
      ? 'semester'
      : 'unsupported';

  const [semesterStorage, setSemesterStorage] = React.useState<TodoListStorage>(() => normalizeListStorage(undefined));
  const semesterStorageRef = React.useRef<TodoListStorage>(normalizeListStorage(undefined));
  const [courseOptions, setCourseOptions] = React.useState<TodoCourseOption[]>([]);
  const courseOptionsRef = React.useRef<TodoCourseOption[]>([]);
  const [loading, setLoading] = React.useState(mode !== 'unsupported');
  const [sortMode, setSortMode] = React.useState<TodoSortMode>('created');
  const [sortDirection, setSortDirection] = React.useState<TodoSortDirection>('asc');
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [taskDialogEditingId, setTaskDialogEditingId] = React.useState<string | null>(null);
  const [taskDraft, setTaskDraft] = React.useState<TaskDraft>(createTaskDraft());
  const [inlineCreateOpen, setInlineCreateOpen] = React.useState(false);
  const [inlineDraft, setInlineDraft] = React.useState<TaskDraft>(createTaskDraft());
  const [sectionTitleDialogOpen, setSectionTitleDialogOpen] = React.useState(false);
  const [sectionTitleDraft, setSectionTitleDraft] = React.useState('');
  const [sectionTitleTargetId, setSectionTitleTargetId] = React.useState<string | null>(null);
  const [deleteSectionDialogOpen, setDeleteSectionDialogOpen] = React.useState(false);
  const [deleteSectionTarget, setDeleteSectionTarget] = React.useState<TodoSection | null>(null);
  const [semesterSettingsSnapshot, setSemesterSettingsSnapshot] = React.useState<Record<string, unknown>>(
    isRecord(settings) ? settings : {},
  );

  const semesterMetaRef = React.useRef<SemesterTabMeta>({ baseSettings: {} });
  const courseMetaRef = React.useRef<Record<string, CourseMirrorMeta>>({});

  const behavior = React.useMemo(() => normalizeTodoBehaviorSettings(semesterSettingsSnapshot), [semesterSettingsSnapshot]);

  const courseDisplayName = React.useMemo(() => {
    if (!courseId) return 'Todo';
    return courseOptions.find((course) => course.id === courseId)?.name ?? 'Course Todo';
  }, [courseId, courseOptions]);

  const normalizedRuntimeStorage = React.useCallback((input: TodoListStorage) => {
    return normalizeListStorage(input, courseOptionsRef.current);
  }, []);

  const persistSynchronizedStorage = React.useCallback(async (
    nextStorage: TodoListStorage,
    publishSource: 'course' | 'semester',
    targetCourseId?: string,
  ) => {
    if (!semesterId) return;

    const normalized = normalizedRuntimeStorage(nextStorage);
    const nextSemesterSettings = serializeSemesterTodoSettings(semesterMetaRef.current.baseSettings, normalized);
    setSemesterSettingsSnapshot(nextSemesterSettings);

    try {
      let nextSemesterTabId = semesterMetaRef.current.tabId;

      if (nextSemesterTabId) {
        const updated = await api.updateTab(nextSemesterTabId, { settings: JSON.stringify(nextSemesterSettings) });
        semesterMetaRef.current = {
          tabId: updated.id,
          baseSettings: parseJsonObject(updated.settings),
        };
      } else {
        const created = await api.createTab(semesterId, {
          tab_type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
          title: 'Todo',
          settings: JSON.stringify(nextSemesterSettings),
        });
        nextSemesterTabId = created.id;
        semesterMetaRef.current = {
          tabId: created.id,
          baseSettings: parseJsonObject(created.settings),
        };
      }

      await Promise.all(Object.values(courseMetaRef.current).map(async (meta) => {
        const mirroredStorage = buildCourseMirrorStorage(normalized, meta.course);
        const nextCourseSettings = serializeCourseTodoSettings(meta.baseSettings, mirroredStorage);

        if (meta.tabId) {
          const updated = await api.updateTab(meta.tabId, { settings: JSON.stringify(nextCourseSettings) });
          courseMetaRef.current[meta.course.id] = {
            ...meta,
            tabId: updated.id,
            baseSettings: parseJsonObject(updated.settings),
          };
          return;
        }

        const created = await api.createTabForCourse(meta.course.id, {
          tab_type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
          title: 'Todo',
          settings: JSON.stringify(nextCourseSettings),
        });
        courseMetaRef.current[meta.course.id] = {
          ...meta,
          tabId: created.id,
          baseSettings: parseJsonObject(created.settings),
        };
      }));

      timetableEventBus.publish('timetable:todo-storage-changed', {
        semesterId,
        source: 'semester',
        listId: semesterId,
        storage: normalized,
      });
      timetableEventBus.publish('timetable:schedule-data-changed', {
        semesterId,
        source: publishSource,
        courseId: publishSource === 'course' ? targetCourseId : undefined,
        reason: 'events-updated',
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to save todo changes.');
    }
  }, [normalizedRuntimeStorage, semesterId]);

  const applyStorageMutation = React.useCallback((
    updater: (current: TodoListStorage) => TodoListStorage,
    publishSource: 'course' | 'semester',
    targetCourseId?: string,
  ) => {
    const nextStorage = normalizedRuntimeStorage(updater(semesterStorageRef.current));
    semesterStorageRef.current = nextStorage;
    setSemesterStorage(nextStorage);
    void persistSynchronizedStorage(nextStorage, publishSource, targetCourseId);
  }, [normalizedRuntimeStorage, persistSynchronizedStorage]);

  React.useEffect(() => {
    if (!semesterId || mode === 'unsupported') return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const semester = await api.getSemester(semesterId);
        const courseSnapshots = await Promise.all(
          (semester.courses ?? []).map(async (course) => {
            try {
              const detail = Array.isArray(course.tabs) ? course : await api.getCourse(course.id);
              return {
                courseId: course.id,
                courseName: course.name,
                courseCategory: course.category ?? '',
                todoTab: detail.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE),
              };
            } catch {
              return {
                courseId: course.id,
                courseName: course.name,
                courseCategory: course.category ?? '',
                todoTab: undefined,
              };
            }
          }),
        );
        const semesterTodoTab = semester.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
        const semesterSettings = parseJsonObject(semesterTodoTab?.settings);
        const semesterState = normalizeSemesterTodoState(semesterSettings, courseSnapshots);

        if (cancelled) return;

        const nextStorage = normalizedRuntimeStorage({
          sections: semesterState.sections,
          tasks: semesterState.tasks,
        });
        semesterStorageRef.current = nextStorage;
        setSemesterStorage(nextStorage);
        courseOptionsRef.current = semesterState.courseOptions;
        setCourseOptions(semesterState.courseOptions);
        setSemesterSettingsSnapshot(semesterSettings);
        semesterMetaRef.current = {
          tabId: semesterTodoTab?.id,
          baseSettings: semesterSettings,
        };
        courseMetaRef.current = Object.fromEntries(courseSnapshots.map((course) => [
          course.courseId,
          {
            tabId: course.todoTab?.id,
            baseSettings: parseJsonObject(course.todoTab?.settings),
            course: {
              id: course.courseId,
              name: course.courseName,
              category: course.courseCategory,
            },
          } satisfies CourseMirrorMeta,
        ]));

        if (!isRecord(semesterSettings.semesterTodo)) {
          void persistSynchronizedStorage(nextStorage, 'semester');
        }
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to load todo data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [mode, persistSynchronizedStorage, semesterId, normalizedRuntimeStorage]);

  useEventBus('timetable:todo-storage-changed', (payload) => {
    if (!semesterId || payload.semesterId !== semesterId) return;
    const normalized = normalizedRuntimeStorage(payload.storage);
    semesterStorageRef.current = normalized;
    setSemesterStorage(normalized);
  });

  const activeList = React.useMemo<TodoListModel>(() => {
    const tasks = courseId
      ? semesterStorage.tasks.filter((task) => task.courseId === courseId)
      : semesterStorage.tasks;

    return {
      id: courseId ? `course:${courseId}` : `semester:${semesterId ?? 'todo'}`,
      name: courseId ? courseDisplayName : 'Todo',
      source: courseId ? 'course' : 'semester',
      canManageSections: mode === 'semester',
      showCourseTag: mode === 'semester',
      courseId,
      sections: semesterStorage.sections,
      tasks,
    };
  }, [courseDisplayName, courseId, mode, semesterId, semesterStorage.sections, semesterStorage.tasks]);

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
  } = useTodoTaskDrag({
    onTaskDrop: (sourceTaskId, targetSectionId, beforeTaskId) => {
      applyStorageMutation((current) => {
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
      }, courseId ? 'course' : 'semester', courseId);
    },
  });

  React.useEffect(() => {
    resetTaskDragState();
  }, [activeList.id, resetTaskDragState]);

  const { isSectionOpen, setSectionOpen } = useTodoSectionOpenMap();

  const openTaskDialogForCreate = React.useCallback(() => {
    setTaskDialogEditingId(null);
    setTaskDraft(createTaskDraft('', courseId ?? ''));
    setTaskDialogOpen(true);
  }, [courseId]);

  const openTaskDialogForEdit = React.useCallback((task: TodoTask) => {
    setTaskDialogEditingId(task.id);
    setTaskDraft({
      title: task.title,
      description: task.description,
      sectionId: task.sectionId,
      courseId: task.courseId,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      priority: task.priority,
    });
    setTaskDialogOpen(true);
  }, []);

  const saveTaskDraft = React.useCallback((draft: TaskDraft, editingTaskId: string | null) => {
    const title = draft.title.trim();
    if (!title) {
      toast.message('Task title is required.');
      return false;
    }

    const selectedCourse = draft.courseId
      ? courseOptions.find((course) => course.id === draft.courseId)
      : undefined;
    const safeSectionId = userSectionsOf(semesterStorageRef.current.sections).some((section) => section.id === draft.sectionId)
      ? draft.sectionId
      : '';

    applyStorageMutation((current) => {
      if (editingTaskId) {
        return {
          ...current,
          tasks: current.tasks.map((task) => {
            if (task.id !== editingTaskId) return task;

            const nextCourse = selectedCourse ?? {
              id: '',
              name: '',
              category: '',
            };

            return {
              ...task,
              title,
              description: draft.description,
              sectionId: task.completed && behavior.moveCompletedToCompletedSection ? COMPLETED_SECTION_ID : safeSectionId,
              originSectionId: task.completed ? (safeSectionId || undefined) : undefined,
              courseId: nextCourse.id,
              courseName: nextCourse.name,
              courseCategory: nextCourse.category,
              dueDate: ensureDateValue(draft.dueDate),
              dueTime: ensureTimeValue(draft.dueTime),
              priority: draft.priority,
              updatedAt: nowIso(),
            };
          }),
        };
      }

      const createdAt = nowIso();
      const nextCourse = selectedCourse ?? { id: '', name: '', category: '' };
      const nextTask: TodoTask = {
        id: makeId('task'),
        title,
        description: draft.description,
        sectionId: safeSectionId,
        originSectionId: undefined,
        courseId: nextCourse.id,
        courseName: nextCourse.name,
        courseCategory: nextCourse.category,
        dueDate: ensureDateValue(draft.dueDate),
        dueTime: ensureTimeValue(draft.dueTime),
        priority: draft.priority,
        completed: false,
        order: current.tasks.length,
        createdAt,
        updatedAt: createdAt,
      };

      return {
        ...current,
        tasks: [...current.tasks, nextTask],
      };
    }, draft.courseId || courseId ? 'course' : 'semester', draft.courseId || courseId);

    return true;
  }, [applyStorageMutation, behavior.moveCompletedToCompletedSection, courseId, courseOptions]);

  const handleSaveDialogTask = React.useCallback(() => {
    const saved = saveTaskDraft(taskDraft, taskDialogEditingId);
    if (!saved) return;
    setTaskDialogOpen(false);
    setTaskDialogEditingId(null);
  }, [saveTaskDraft, taskDialogEditingId, taskDraft]);

  const handleSaveInlineTask = React.useCallback(() => {
    const saved = saveTaskDraft(inlineDraft, null);
    if (!saved) return;
    setInlineCreateOpen(false);
    setInlineDraft(createTaskDraft('', courseId ?? ''));
  }, [courseId, inlineDraft, saveTaskDraft]);

  const handleToggleTaskCompleted = React.useCallback((taskId: string, completed: boolean) => {
    applyStorageMutation(
      (current) => toggleTodoTaskCompletedInStorage(current, taskId, completed, {
        moveCompletedToCompletedSection: behavior.moveCompletedToCompletedSection,
      }),
      courseId ? 'course' : 'semester',
      courseId,
    );
  }, [applyStorageMutation, behavior.moveCompletedToCompletedSection, courseId]);

  const handleDeleteTask = React.useCallback((taskId: string) => {
    const deletedTask = semesterStorageRef.current.tasks.find((task) => task.id === taskId);
    applyStorageMutation(
      (current) => ({
        ...current,
        tasks: current.tasks.filter((task) => task.id !== taskId),
      }),
      deletedTask?.courseId ? 'course' : 'semester',
      deletedTask?.courseId || undefined,
    );
  }, [applyStorageMutation]);

  const handleAddSection = React.useCallback(() => {
    if (mode !== 'semester') return;
    applyStorageMutation((current) => {
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
    }, 'semester');
  }, [applyStorageMutation, mode]);

  const openSectionTitleEditor = React.useCallback((section: TodoSection) => {
    if (mode !== 'semester' || section.id === COMPLETED_SECTION_ID) return;
    setSectionTitleTargetId(section.id);
    setSectionTitleDraft(section.name);
    setSectionTitleDialogOpen(true);
  }, [mode]);

  const saveSectionTitle = React.useCallback(() => {
    if (!sectionTitleTargetId) return;
    const nextTitle = sectionTitleDraft.trim() || DEFAULT_SECTION_NAME;
    applyStorageMutation((current) => {
      const nextUsers = userSectionsOf(current.sections)
        .map((section) => (section.id === sectionTitleTargetId ? { ...section, name: nextTitle } : section))
        .map((section, index) => ({ ...section, order: index, isSystem: false }));
      return {
        ...current,
        sections: [...nextUsers, completedSection(nextUsers.length)],
      };
    }, 'semester');
    setSectionTitleDialogOpen(false);
    setSectionTitleTargetId(null);
  }, [applyStorageMutation, sectionTitleDraft, sectionTitleTargetId]);

  const confirmDeleteSection = React.useCallback(() => {
    if (!deleteSectionTarget) return;
    applyStorageMutation((current) => {
      const nextUsers = userSectionsOf(current.sections)
        .filter((section) => section.id !== deleteSectionTarget.id)
        .map((section, index) => ({ ...section, order: index, isSystem: false }));
      const fallbackSectionId = nextUsers[0]?.id ?? '';

      return {
        sections: [...nextUsers, completedSection(nextUsers.length)],
        tasks: current.tasks.map((task) => {
          if (task.sectionId !== deleteSectionTarget.id) return task;
          return {
            ...task,
            sectionId: task.completed && behavior.moveCompletedToCompletedSection ? COMPLETED_SECTION_ID : fallbackSectionId,
            originSectionId: task.completed ? (fallbackSectionId || undefined) : undefined,
            updatedAt: nowIso(),
          };
        }),
      };
    }, 'semester');
    setDeleteSectionDialogOpen(false);
    setDeleteSectionTarget(null);
  }, [applyStorageMutation, behavior.moveCompletedToCompletedSection, deleteSectionTarget]);

  const subtitle = React.useMemo(() => {
    const total = activeList.tasks.length;
    const completed = activeList.tasks.filter((task) => task.completed).length;
    if (mode === 'course') {
      return `${courseDisplayName} · ${completed}/${total} completed`;
    }
    return `${courseOptions.length} courses · ${completed}/${total} completed`;
  }, [activeList.tasks, courseDisplayName, courseOptions.length, mode]);

  const renderTaskCard = React.useCallback((task: TodoTask, sectionId: string) => {
    return (
      <TodoTaskCard
        key={task.id}
        task={task}
        sectionId={sectionId}
        completedSectionId={COMPLETED_SECTION_ID}
        draggingTaskId={draggingTaskId}
        showCourseTag={activeList.showCourseTag}
        getCourseTagClassName={getCourseCategoryBadgeClassName}
        onTaskDragStart={handleTaskDragStart}
        onTaskDragEnd={handleTaskDragEnd}
        onTaskDragOverSection={handleTaskDragOverSection}
        onTaskDropToSection={handleTaskDropToSection}
        onToggleTaskCompleted={handleToggleTaskCompleted}
        onOpenEditTaskDialog={openTaskDialogForEdit}
        onDeleteTask={handleDeleteTask}
        getPriorityMeta={getPriorityMeta}
        formatTaskDue={formatTaskDue}
      />
    );
  }, [
    activeList.showCourseTag,
    draggingTaskId,
    handleDeleteTask,
    handleTaskDragEnd,
    handleTaskDragOverSection,
    handleTaskDragStart,
    handleTaskDropToSection,
    handleToggleTaskCompleted,
    openTaskDialogForEdit,
  ]);

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

  return (
    <div className="space-y-4 select-none">
      <div className="min-w-0 px-2 py-3 sm:px-4">
        {loading ? (
          <TodoMainPanelSkeleton />
        ) : (
          <>
            <TodoMainHeader
              mode={mode}
              title={activeList.name}
              subtitle={subtitle}
              sortMode={sortMode}
              sortDirection={sortDirection}
              sortOptions={SORT_OPTIONS}
              onSortModeChange={setSortMode}
              onSortDirectionChange={setSortDirection}
              onAddSection={handleAddSection}
              onOpenCreateTaskDialog={openTaskDialogForCreate}
            />

            <div className="space-y-4 pt-4">
              <TodoUnsectionedBlock
                sectionId={UNSECTIONED_TASK_BUCKET_ID}
                tasks={unsectionedTasks}
                dragOverSectionId={dragOverSectionId}
                onDragOverSection={handleTaskDragOverSection}
                onDropToSection={handleTaskDropToSection}
                renderTaskCard={renderTaskCard}
              />

              {activeListUserSections.map((section) => (
                <TodoSectionBlock
                  key={section.id}
                  section={section}
                  tasks={sectionTasksMap.get(section.id) ?? []}
                  completedSectionId={COMPLETED_SECTION_ID}
                  isOpen={isSectionOpen(activeList.id, section.id)}
                  canDeleteSection={mode === 'semester'}
                  dragOverSectionId={dragOverSectionId}
                  onOpenChange={(open) => setSectionOpen(activeList.id, section.id, open)}
                  onDragOverSection={handleTaskDragOverSection}
                  onDropToSection={handleTaskDropToSection}
                  onOpenSectionTitleEditor={openSectionTitleEditor}
                  onRequestDeleteSection={(sectionToDelete) => {
                    setDeleteSectionTarget(sectionToDelete);
                    setDeleteSectionDialogOpen(true);
                  }}
                  renderTaskCard={renderTaskCard}
                />
              ))}

              <TodoSectionBlock
                section={completedSection(activeListUserSections.length)}
                tasks={sectionTasksMap.get(COMPLETED_SECTION_ID) ?? []}
                completedSectionId={COMPLETED_SECTION_ID}
                isOpen={isSectionOpen(activeList.id, COMPLETED_SECTION_ID)}
                canDeleteSection={false}
                dragOverSectionId={dragOverSectionId}
                onOpenChange={(open) => setSectionOpen(activeList.id, COMPLETED_SECTION_ID, open)}
                onDragOverSection={handleTaskDragOverSection}
                onDropToSection={handleTaskDropToSection}
                onOpenSectionTitleEditor={() => undefined}
                onRequestDeleteSection={() => undefined}
                renderTaskCard={renderTaskCard}
              />

              <TodoInlineCreateRow
                mode={mode}
                open={inlineCreateOpen}
                draft={inlineDraft}
                courseOptions={courseOptions}
                priorityOptions={PRIORITY_OPTIONS}
                onOpen={() => {
                  setInlineDraft(createTaskDraft('', courseId ?? ''));
                  setInlineCreateOpen(true);
                }}
                onDraftChange={(updater) => setInlineDraft((previous) => updater(previous))}
                onCancel={() => {
                  setInlineCreateOpen(false);
                  setInlineDraft(createTaskDraft('', courseId ?? ''));
                }}
                onSave={handleSaveInlineTask}
              />
            </div>
          </>
        )}
      </div>

      <TodoSectionTitleDialog
        open={sectionTitleDialogOpen}
        titleDraft={sectionTitleDraft}
        onOpenChange={setSectionTitleDialogOpen}
        onTitleDraftChange={setSectionTitleDraft}
        onSave={saveSectionTitle}
      />

      <TodoTaskDialog
        open={taskDialogOpen}
        editingTaskId={taskDialogEditingId}
        taskDraft={taskDraft}
        courseOptions={courseOptions}
        sections={activeListUserSections}
        showCourseField={mode === 'semester'}
        unsectionedBucketId={UNSECTIONED_TASK_BUCKET_ID}
        unsectionedBucketName={UNSECTIONED_TASK_BUCKET_NAME}
        priorityOptions={PRIORITY_OPTIONS}
        onOpenChange={setTaskDialogOpen}
        onTaskDraftChange={(updater) => setTaskDraft((previous) => updater(previous))}
        onSave={handleSaveDialogTask}
      />

      <AlertDialog open={deleteSectionDialogOpen} onOpenChange={setDeleteSectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSectionTarget
                ? `Tasks in ${deleteSectionTarget.name} will move to the first remaining section or No Section.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteSection}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
