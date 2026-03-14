// input:  [Todo tab settings payload, semester todo APIs, runtime mapping helpers, shared UI primitives, and event bus refresh signals]
// output: [TodoTab React component for semester-first Apple Reminder-style todo management backed by the semester todo API]
// pos:    [Todo tab orchestration layer that loads semester todo state, persists local view preferences, issues domain mutations through dedicated APIs, and renders the unified list UI]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import { useSemesterTodoCache, useSemesterTodoQuery } from '@/hooks/useSemesterTodoQuery';
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
import { timetableEventBus, useEventBus } from '../../shared/eventBus';
import { publishTimetableScheduleChange } from '../../shared/publishTimetableScheduleChange';
import { TodoCompletedSummary } from './components/TodoCompletedSummary';
import { TodoInlineCreateRow } from './components/TodoInlineCreateRow';
import { TodoMainHeader } from './components/TodoMainHeader';
import { TodoSectionBlock } from './components/TodoSectionBlock';
import { TodoTaskCard } from './components/TodoTaskCard';
import { TodoUnsectionedBlock } from './components/TodoUnsectionedBlock';
import { TodoTaskDialog } from './components/dialogs/TodoTaskDialog';
import { useTodoSectionOpenMap } from './hooks/useTodoSectionOpenMap';
import { useTodoSectionTasks } from './hooks/useTodoSectionTasks';
import { useTodoTaskDrag } from './hooks/useTodoTaskDrag';
import { useTodoViewPreferences } from './hooks/useTodoViewPreferences';
import { normalizeTodoBehaviorSettings } from './preferences';
import {
  COMPLETED_MOVE_TIMEOUT_MS,
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
  TodoPendingDeleteTarget,
  TodoTabMode,
  TodoTask,
} from './types';
import {
  createSectionName,
  createTaskDraft,
  fromTodoApiState,
  nowIso,
  userSectionsOf,
} from './utils/todoData';

interface TodoTabProps {
  settings: unknown;
  updateSettings: (nextSettings: unknown) => void | Promise<void>;
  courseId?: string;
  semesterId?: string;
}

type RecentCompletedMap = Record<string, true>;

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

const isTextEditingElement = (element: EventTarget | null) => {
  if (!(element instanceof HTMLElement)) return false;
  return Boolean(
    element.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
    || element.closest('[data-slot="popover-content"]')
    || element.closest('[data-slot="select-content"]'),
  );
};

export const TodoTab: React.FC<TodoTabProps> = ({ settings, semesterId, courseId }) => {
  const mode: TodoTabMode = courseId
    ? 'course'
    : semesterId
      ? 'semester'
      : 'unsupported';

  const [semesterStorage, setSemesterStorage] = React.useState<TodoListStorage>({ sections: [], tasks: [] });
  const semesterStorageRef = React.useRef<TodoListStorage>({ sections: [], tasks: [] });
  const [courseOptions, setCourseOptions] = React.useState<TodoCourseOption[]>([]);
  const [loading, setLoading] = React.useState(mode !== 'unsupported');
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [taskDialogEditingId, setTaskDialogEditingId] = React.useState<string | null>(null);
  const [taskDraft, setTaskDraft] = React.useState<TaskDraft>(createTaskDraft());
  const [sectionTitleDraft, setSectionTitleDraft] = React.useState('');
  const [sectionTitleTargetId, setSectionTitleTargetId] = React.useState<string | null>(null);
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = React.useState<TodoPendingDeleteTarget | null>(null);
  const [recentCompletedTaskIds, setRecentCompletedTaskIds] = React.useState<RecentCompletedMap>({});
  const [semesterSettingsSnapshot, setSemesterSettingsSnapshot] = React.useState<Record<string, unknown>>(
    settings && typeof settings === 'object' && !Array.isArray(settings) ? settings as Record<string, unknown> : {},
  );
  const semesterTodoQuery = useSemesterTodoQuery(semesterId);
  const { setTodoState } = useSemesterTodoCache(semesterId);

  const completionTimeoutsRef = React.useRef<Record<string, ReturnType<typeof window.setTimeout>>>({});

  const behavior = React.useMemo(() => normalizeTodoBehaviorSettings(semesterSettingsSnapshot), [semesterSettingsSnapshot]);
  const viewPreferenceScopeKey = React.useMemo(
    () => courseId ? `course:${courseId}` : `semester:${semesterId ?? 'todo'}`,
    [courseId, semesterId],
  );
  const {
    sortMode,
    sortDirection,
    setSortMode,
    setSortDirection,
  } = useTodoViewPreferences(viewPreferenceScopeKey);

  React.useEffect(() => {
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
      setSemesterSettingsSnapshot(settings as Record<string, unknown>);
      return;
    }
    setSemesterSettingsSnapshot({});
  }, [settings]);

  const courseDisplayName = React.useMemo(() => {
    if (!courseId) return 'Todo';
    return courseOptions.find((course) => course.id === courseId)?.name ?? 'Course Todo';
  }, [courseId, courseOptions]);

  const applyServerState = React.useCallback(async (
    nextStorage: TodoListStorage,
    publishSource: 'course' | 'semester',
    targetCourseId?: string,
  ) => {
    semesterStorageRef.current = nextStorage;
    setSemesterStorage(nextStorage);
    timetableEventBus.publish('timetable:todo-storage-changed', {
      semesterId: semesterId ?? '',
      source: 'semester',
      listId: semesterId ?? '',
      storage: nextStorage,
    });
    if (semesterId) {
      await publishTimetableScheduleChange({
        semesterId,
        source: publishSource,
        courseId: publishSource === 'course' ? targetCourseId : undefined,
        reason: 'events-updated',
      });
    }
  }, [semesterId]);

  const runMutation = React.useCallback(async (
    runner: () => Promise<Awaited<ReturnType<typeof api.getSemesterTodo>>>,
    publishSource: 'course' | 'semester',
    targetCourseId?: string,
  ) => {
    try {
      const response = await runner();
      setTodoState(response);
      const nextState = fromTodoApiState(response, behavior.moveCompletedToCompletedSection);
      await applyServerState(
        {
          sections: nextState.sections,
          tasks: nextState.tasks,
        },
        publishSource,
        targetCourseId,
      );
      setCourseOptions(nextState.courseOptions);
      return true;
    } catch (error: any) {
      toast.error(error?.response?.data?.detail?.message ?? error?.message ?? 'Failed to save todo changes.');
      return false;
    }
  }, [applyServerState, behavior.moveCompletedToCompletedSection, setTodoState]);

  React.useEffect(() => {
    if (!semesterId || mode === 'unsupported') {
      setLoading(false);
      return;
    }

    if (semesterTodoQuery.error) {
      toast.error((semesterTodoQuery.error as any)?.response?.data?.detail?.message ?? semesterTodoQuery.error.message ?? 'Failed to load todo data.');
      setLoading(false);
      return;
    }

    if (!semesterTodoQuery.data) {
      setLoading(semesterTodoQuery.isLoading);
      return;
    }

    const semesterState = fromTodoApiState(semesterTodoQuery.data, behavior.moveCompletedToCompletedSection);
    const nextStorage = {
      sections: semesterState.sections,
      tasks: semesterState.tasks,
    };
    semesterStorageRef.current = nextStorage;
    setSemesterStorage(nextStorage);
    setCourseOptions(semesterState.courseOptions);
    setLoading(false);
  }, [
    behavior.moveCompletedToCompletedSection,
    mode,
    semesterId,
    semesterTodoQuery.data,
    semesterTodoQuery.error,
    semesterTodoQuery.isLoading,
  ]);

  useEventBus('timetable:todo-storage-changed', (payload) => {
    if (!semesterId || payload.semesterId !== semesterId) return;
    semesterStorageRef.current = payload.storage;
    setSemesterStorage(payload.storage);
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

  const recentCompletedTaskIdSet = React.useMemo(
    () => new Set(Object.keys(recentCompletedTaskIds)),
    [recentCompletedTaskIds],
  );

  const {
    sectionTasksMap,
    activeListUserSections,
    unsectionedTasks,
  } = useTodoSectionTasks({
    activeList,
    sortMode,
    sortDirection,
    showCompleted,
    recentCompletedTaskIds: recentCompletedTaskIdSet,
  });

  const completedCount = React.useMemo(() => activeList.tasks.filter((task) => task.completed).length, [activeList.tasks]);

  const {
    draggingTaskId,
    dragOverSectionId,
    dragOverTaskId,
    resetTaskDragState,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleTaskDragOverSection,
    handleTaskDragOverItem,
    handleTaskDropToSection,
  } = useTodoTaskDrag({
    onTaskDrop: (sourceTaskId, targetSectionId) => {
      if (!semesterId) return;
      const current = semesterStorageRef.current;
      const sourceTask = current.tasks.find((task) => task.id === sourceTaskId);
      if (!sourceTask || sourceTask.completed) return;

      const nextTargetSectionId = targetSectionId === UNSECTIONED_TASK_BUCKET_ID ? '' : targetSectionId;
      if (nextTargetSectionId === COMPLETED_SECTION_ID) return;

      const validSectionIds = new Set(current.sections.map((section) => section.id));
      if (nextTargetSectionId && !validSectionIds.has(nextTargetSectionId)) return;
      if (sourceTask.sectionId === nextTargetSectionId) return;

      const previousStorage = current;
      const nextStorage = {
        ...current,
        tasks: current.tasks.map((task) => (
          task.id === sourceTaskId
            ? {
              ...task,
              sectionId: nextTargetSectionId,
              updatedAt: nowIso(),
            }
            : task
        )),
      };

      semesterStorageRef.current = nextStorage;
      setSemesterStorage(nextStorage);

      void (async () => {
        const saved = await runMutation(
          () => api.updateSemesterTodoTask(semesterId, sourceTaskId, {
            section_id: nextTargetSectionId || null,
          }),
          sourceTask.courseId || courseId ? 'course' : 'semester',
          sourceTask.courseId || courseId,
        );

        if (!saved) {
          semesterStorageRef.current = previousStorage;
          setSemesterStorage(previousStorage);
        }
      })();
    },
  });

  React.useEffect(() => {
    resetTaskDragState();
    setSelectedTaskId(null);
  }, [activeList.id, resetTaskDragState]);

  React.useEffect(() => {
    if (!selectedTaskId) return;
    if (activeList.tasks.some((task) => task.id === selectedTaskId)) return;
    setSelectedTaskId(null);
  }, [activeList.tasks, selectedTaskId]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedTaskId || isTextEditingElement(event.target)) return;
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        if (event.key === 'Escape') {
          setSelectedTaskId(null);
        }
        return;
      }

      const task = activeList.tasks.find((item) => item.id === selectedTaskId);
      if (!task) return;

      event.preventDefault();
      setPendingDeleteTarget({
        kind: 'task',
        taskId: task.id,
        taskTitle: task.title,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeList.tasks, selectedTaskId]);

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
      note: task.note,
      sectionId: task.completed && task.sectionId === COMPLETED_SECTION_ID ? (task.originSectionId ?? '') : task.sectionId,
      courseId: task.courseId,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      priority: task.priority,
    });
    setTaskDialogOpen(true);
  }, []);

  const saveTaskDraft = React.useCallback(async (draft: TaskDraft, editingTaskId: string | null) => {
    if (!semesterId) return false;
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

    const didSave = editingTaskId
      ? await runMutation(
        () => api.updateSemesterTodoTask(semesterId, editingTaskId, {
          title,
          note: draft.note,
          section_id: safeSectionId || null,
          origin_section_id: safeSectionId || null,
          course_id: selectedCourse?.id || null,
          due_date: draft.dueDate || null,
          due_time: draft.dueTime || null,
          priority: draft.priority,
        }),
        draft.courseId || courseId ? 'course' : 'semester',
        draft.courseId || courseId,
      )
      : await runMutation(
        () => api.createSemesterTodoTask(semesterId, {
          title,
          note: draft.note,
          section_id: safeSectionId || null,
          course_id: selectedCourse?.id || null,
          due_date: draft.dueDate || null,
          due_time: draft.dueTime || null,
          priority: draft.priority,
        }),
        draft.courseId || courseId ? 'course' : 'semester',
        draft.courseId || courseId,
      );

    return didSave;
  }, [courseId, courseOptions, runMutation, semesterId]);

  const handleSaveDialogTask = React.useCallback(async () => {
    const saved = await saveTaskDraft(taskDraft, taskDialogEditingId);
    if (!saved) return;
    setTaskDialogOpen(false);
    setTaskDialogEditingId(null);
  }, [saveTaskDraft, taskDialogEditingId, taskDraft]);

  const handleSaveInlineTask = React.useCallback(async (draft: TaskDraft) => {
    return await saveTaskDraft(draft, null);
  }, [saveTaskDraft]);

  const handleToggleTaskCompleted = React.useCallback((taskId: string, completed: boolean) => {
    if (!semesterId) return;
    if (completionTimeoutsRef.current[taskId]) {
      window.clearTimeout(completionTimeoutsRef.current[taskId]);
      delete completionTimeoutsRef.current[taskId];
    }

    if (completed) {
      setRecentCompletedTaskIds((previous) => ({ ...previous, [taskId]: true }));
      completionTimeoutsRef.current[taskId] = window.setTimeout(() => {
        setRecentCompletedTaskIds((previous) => {
          const next = { ...previous };
          delete next[taskId];
          return next;
        });
        delete completionTimeoutsRef.current[taskId];
      }, COMPLETED_MOVE_TIMEOUT_MS);
    } else {
      setRecentCompletedTaskIds((previous) => {
        if (!(taskId in previous)) return previous;
        const next = { ...previous };
        delete next[taskId];
        return next;
      });
    }

    void runMutation(
      () => api.updateSemesterTodoTask(semesterId, taskId, { completed }),
      courseId ? 'course' : 'semester',
      courseId,
    );
  }, [courseId, runMutation, semesterId]);

  const handlePatchTask = React.useCallback((
    taskId: string,
    patch: Partial<Pick<TodoTask, 'title' | 'note' | 'dueDate' | 'dueTime' | 'priority' | 'courseId' | 'courseName' | 'courseCategory'>>,
  ) => {
    if (!semesterId) return;
    void runMutation(
      () => api.updateSemesterTodoTask(semesterId, taskId, {
        title: patch.title,
        note: patch.note,
        due_date: patch.dueDate === undefined ? undefined : (patch.dueDate || null),
        due_time: patch.dueTime === undefined ? undefined : (patch.dueTime || null),
        priority: patch.priority,
        course_id: patch.courseId === undefined ? undefined : (patch.courseId || null),
      }),
      courseId ? 'course' : 'semester',
      patch.courseId || courseId,
    );
  }, [courseId, runMutation, semesterId]);

  const handleAddSection = React.useCallback(() => {
    if (mode !== 'semester' || !semesterId) return;
    void runMutation(
      () => api.createSemesterTodoSection(semesterId, { name: createSectionName(semesterStorageRef.current) }),
      'semester',
    );
  }, [mode, runMutation, semesterId]);

  const confirmDelete = React.useCallback(() => {
    if (!pendingDeleteTarget) return;

    if (pendingDeleteTarget.kind === 'task' && pendingDeleteTarget.taskId) {
      const taskId = pendingDeleteTarget.taskId;
      const deletedTask = semesterStorageRef.current.tasks.find((task) => task.id === pendingDeleteTarget.taskId);
      if (semesterId) {
        void runMutation(
          () => api.deleteSemesterTodoTask(semesterId, taskId),
          deletedTask?.courseId ? 'course' : 'semester',
          deletedTask?.courseId || undefined,
        );
      }
    }

    if (pendingDeleteTarget.kind === 'completed') {
      if (semesterId) {
        if (courseId) {
          const completedTaskIds = semesterStorageRef.current.tasks
            .filter((task) => task.courseId === courseId && task.completed)
            .map((task) => task.id);
          void runMutation(
            async () => {
              await Promise.all(completedTaskIds.map((taskId) => api.deleteSemesterTodoTask(semesterId, taskId)));
              return api.getSemesterTodo(semesterId);
            },
            'course',
            courseId,
          );
        } else {
          void runMutation(
            () => api.clearCompletedSemesterTodoTasks(semesterId),
            'semester',
          );
        }
      }
    }

    if (pendingDeleteTarget.kind === 'section' && pendingDeleteTarget.sectionId) {
      const sectionId = pendingDeleteTarget.sectionId;
      if (semesterId) {
        void runMutation(
          () => api.deleteSemesterTodoSection(semesterId, sectionId),
          'semester',
        );
      }
    }

    setPendingDeleteTarget(null);
  }, [courseId, pendingDeleteTarget, runMutation, semesterId]);

  const renderComposer = React.useCallback((sectionId: string, placeholder: string) => {
    return (
      <TodoInlineCreateRow
        mode={mode}
        sectionId={sectionId}
        initialCourseId={courseId ?? ''}
        courseOptions={courseOptions}
        priorityOptions={PRIORITY_OPTIONS}
        placeholder={placeholder}
        onSave={handleSaveInlineTask}
      />
    );
  }, [courseId, courseOptions, handleSaveInlineTask, mode]);

  const renderTaskCard = React.useCallback((task: TodoTask, sectionId: string) => {
    return (
      <TodoTaskCard
        key={task.id}
        mode={mode}
        task={task}
        sectionId={sectionId}
        draggingTaskId={draggingTaskId}
        dragOverTaskId={dragOverTaskId}
        showCourseTag={activeList.showCourseTag}
        isSelected={selectedTaskId === task.id}
        courseOptions={courseOptions}
        priorityOptions={PRIORITY_OPTIONS}
        onTaskDragStart={handleTaskDragStart}
        onTaskDragEnd={handleTaskDragEnd}
        onTaskDragOverItem={handleTaskDragOverItem}
        onTaskDropToSection={handleTaskDropToSection}
        onToggleTaskCompleted={handleToggleTaskCompleted}
        onPatchTask={handlePatchTask}
        onOpenDetails={openTaskDialogForEdit}
        onRequestDelete={(targetTask) => {
          setPendingDeleteTarget({
            kind: 'task',
            taskId: targetTask.id,
            taskTitle: targetTask.title,
          });
        }}
        onSelect={(taskId) => {
          setSelectedTaskId(taskId);
        }}
      />
    );
  }, [
    activeList.showCourseTag,
    courseOptions,
    dragOverTaskId,
    draggingTaskId,
    handlePatchTask,
    handleTaskDragEnd,
    handleTaskDragOverItem,
    handleTaskDragStart,
    handleTaskDropToSection,
    handleToggleTaskCompleted,
    mode,
    openTaskDialogForEdit,
    selectedTaskId,
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

  const pendingDeleteTitle = pendingDeleteTarget?.kind === 'section'
    ? 'Delete section?'
    : pendingDeleteTarget?.kind === 'completed'
      ? 'Clear completed tasks?'
      : 'Delete task?';

  const pendingDeleteDescription = pendingDeleteTarget?.kind === 'section'
    ? `Tasks in ${pendingDeleteTarget.sectionName} will move to the first remaining section or No Section.`
    : pendingDeleteTarget?.kind === 'completed'
      ? 'This removes every completed task currently in this list.'
      : pendingDeleteTarget?.taskTitle
        ? `Remove "${pendingDeleteTarget.taskTitle}" from this list?`
        : 'This action cannot be undone.';

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
              sortMode={sortMode}
              sortDirection={sortDirection}
              sortOptions={SORT_OPTIONS}
              onSortModeChange={setSortMode}
              onSortDirectionChange={setSortDirection}
              onAddSection={handleAddSection}
              onOpenCreateTaskDialog={openTaskDialogForCreate}
            />

            <div className="space-y-4 pt-4">
              <TodoCompletedSummary
                completedCount={completedCount}
                showCompleted={showCompleted}
                onToggleShowCompleted={() => setShowCompleted((previous) => !previous)}
                onClearCompleted={() => setPendingDeleteTarget({ kind: 'completed' })}
              />

              <TodoUnsectionedBlock
                sectionId={UNSECTIONED_TASK_BUCKET_ID}
                visibleTasks={unsectionedTasks.visible}
                dragOverSectionId={dragOverSectionId}
                onDragOverSection={handleTaskDragOverSection}
                onDropToSection={handleTaskDropToSection}
                renderTaskCard={renderTaskCard}
                composer={renderComposer(UNSECTIONED_TASK_BUCKET_ID, 'Add a todo')}
              />

              {activeListUserSections.map((section) => {
                const buckets = sectionTasksMap.get(section.id) ?? { active: [], completed: [], visible: [] };
                return (
                  <TodoSectionBlock
                    key={section.id}
                    section={section}
                    visibleTasks={buckets.visible}
                    isOpen={isSectionOpen(activeList.id, section.id)}
                    canDeleteSection={mode === 'semester'}
                    isEditingTitle={sectionTitleTargetId === section.id}
                    titleDraft={sectionTitleTargetId === section.id ? sectionTitleDraft : section.name}
                    dragOverSectionId={dragOverSectionId}
                    onOpenChange={(open) => setSectionOpen(activeList.id, section.id, open)}
                    onDragOverSection={handleTaskDragOverSection}
                    onDropToSection={handleTaskDropToSection}
                    onStartEditingTitle={(targetSection) => {
                      if (mode !== 'semester') return;
                      setSectionTitleTargetId(targetSection.id);
                      setSectionTitleDraft(targetSection.name);
                    }}
                    onTitleDraftChange={setSectionTitleDraft}
                    onSubmitTitle={() => {
                      if (!sectionTitleTargetId || !semesterId) return;
                      const nextTitle = sectionTitleDraft.trim() || DEFAULT_SECTION_NAME;
                      void runMutation(
                        () => api.updateSemesterTodoSection(semesterId, sectionTitleTargetId, { name: nextTitle }),
                        'semester',
                      );
                      setSectionTitleTargetId(null);
                    }}
                    onCancelTitle={() => {
                      setSectionTitleTargetId(null);
                      setSectionTitleDraft('');
                    }}
                    onRequestDeleteSection={(sectionToDelete) => {
                      setPendingDeleteTarget({
                        kind: 'section',
                        sectionId: sectionToDelete.id,
                        sectionName: sectionToDelete.name,
                      });
                    }}
                    renderTaskCard={renderTaskCard}
                    composer={renderComposer(section.id, `Add to ${section.name}`)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

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

      <AlertDialog open={pendingDeleteTarget !== null} onOpenChange={(open) => !open && setPendingDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDeleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
