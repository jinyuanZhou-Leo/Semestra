// input:  [Todo task item data, inline quick-edit callbacks, drag state, and display helpers]
// output: [TodoTaskCard React component]
// pos:    [Reminder-inspired task row with inline title/meta editing, selection, swipe delete, and drag handle affordances]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { addDays, format, isSameDay } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getCourseBadgeStyle, getDistinctCourseBadgeClassName } from '@/utils/courseCategoryBadge';
import { TodoMetaEditorChips } from './TodoMetaEditorChips';
import { getPriorityMeta } from '../utils/todoData';
import type { TodoCourseOption, TodoPriorityOption, TodoTabMode, TodoTask } from '../types';

interface TodoTaskCardProps {
  mode: TodoTabMode;
  task: TodoTask;
  sectionId: string;
  draggingTaskId: string | null;
  dragOverTaskId: string | null;
  showCourseTag: boolean;
  isSelected: boolean;
  courseOptions: TodoCourseOption[];
  priorityOptions: TodoPriorityOption[];
  onTaskDragStart: (task: TodoTask) => void;
  onTaskDragEnd: () => void;
  onTaskDragOverItem: (event: React.DragEvent<HTMLElement>, targetSectionId: string, beforeTaskId: string) => void;
  onTaskDropToSection: (
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => void;
  onToggleTaskCompleted: (taskId: string, completed: boolean) => void;
  onPatchTask: (
    taskId: string,
    patch: Partial<Pick<TodoTask, 'title' | 'description' | 'dueDate' | 'dueTime' | 'priority' | 'courseId' | 'courseName' | 'courseCategory'>>,
  ) => void;
  onOpenDetails: (task: TodoTask) => void;
  onRequestDelete: (task: TodoTask) => void;
  onSelect: (taskId: string) => void;
}

const isInteractiveTarget = (target: EventTarget | null) => {
  return target instanceof HTMLElement
    && Boolean(target.closest('button,input,textarea,[role="button"],[data-slot="select-trigger"],[data-slot="popover-trigger"],[data-no-swipe="true"]'));
};

export const TodoTaskCard: React.FC<TodoTaskCardProps> = ({
  mode,
  task,
  sectionId,
  draggingTaskId,
  dragOverTaskId,
  showCourseTag,
  isSelected,
  courseOptions,
  priorityOptions,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDragOverItem,
  onTaskDropToSection,
  onToggleTaskCompleted,
  onPatchTask,
  onOpenDetails,
  onRequestDelete,
  onSelect,
}) => {
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const descriptionInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(task.title);
  const [descriptionDraft, setDescriptionDraft] = React.useState(task.description);
  const [swipeOffset, setSwipeOffset] = React.useState(0);
  const pointerStateRef = React.useRef<{ pointerId: number; startX: number; startY: number; swiping: boolean } | null>(null);
  const isOverdue = !task.completed && Boolean(task.dueDate) && new Date(`${task.dueDate}T${task.dueTime || '23:59'}:00`).getTime() < Date.now();
  const isExpanded = editorOpen;
  const compactDescription = task.description.trim();
  const completedTextClassName = 'text-[14px] leading-[1.25] text-muted-foreground/88';
  const distinctCourseIds = React.useMemo(() => courseOptions.map((course) => course.id), [courseOptions]);
  const compactMeta = React.useMemo(() => {
    const parts: Array<{ key: string; label: string; className?: string; kind?: 'course'; style?: React.CSSProperties }> = [];

    if (task.dueDate) {
      const parsedDate = new Date(`${task.dueDate}T12:00:00`);
      const today = new Date();
      const tomorrow = addDays(today, 1);
      const dateLabel = isSameDay(parsedDate, today)
        ? 'Today'
        : isSameDay(parsedDate, tomorrow)
          ? 'Tomorrow'
          : format(parsedDate, 'yyyy-MM-dd');
      parts.push({
        key: 'due',
        label: task.dueTime ? `${dateLabel}, ${task.dueTime}` : dateLabel,
        className: task.completed ? 'text-muted-foreground/88' : (isOverdue ? 'text-destructive' : 'text-muted-foreground'),
      });
    }

    if (task.courseId && showCourseTag) {
      const selectedCourse = courseOptions.find((course) => course.id === task.courseId);
      parts.push({
        key: 'course',
        label: `#${task.courseName}`,
        className: getDistinctCourseBadgeClassName(task.courseId, distinctCourseIds, task.courseCategory),
        kind: 'course',
        style: getCourseBadgeStyle(selectedCourse?.color),
      });
    }

    const priorityMeta = getPriorityMeta(task.priority);
    if (priorityMeta) {
      parts.push({
        key: 'priority',
        label: priorityMeta.label,
        className: priorityMeta.className.split(' ').find((token) => token.startsWith('text-')) ?? 'text-muted-foreground',
      });
    }

    return parts;
  }, [courseOptions, distinctCourseIds, isOverdue, showCourseTag, task.courseCategory, task.courseId, task.courseName, task.dueDate, task.dueTime, task.priority]);

  React.useEffect(() => {
    if (!editingTitle) {
      setTitleDraft(task.title);
    }
  }, [editingTitle, task.title]);

  React.useEffect(() => {
    setDescriptionDraft(task.description);
  }, [task.description]);

  React.useEffect(() => {
    if (isSelected) return;
    setEditingTitle(false);
    setEditorOpen(false);
  }, [isSelected]);

  const commitTitle = React.useCallback(() => {
    const nextTitle = titleDraft.trim();
    setEditingTitle(false);
    if (!nextTitle || nextTitle === task.title) return;
    onPatchTask(task.id, { title: nextTitle });
  }, [onPatchTask, task.id, task.title, titleDraft]);

  const commitDescription = React.useCallback(() => {
    if (descriptionDraft === task.description) return;
    onPatchTask(task.id, { description: descriptionDraft });
  }, [descriptionDraft, onPatchTask, task.description, task.id]);

  const focusTitleEditor = React.useCallback(() => {
    onSelect(task.id);
    setEditorOpen(true);
    setEditingTitle(true);
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  }, [onSelect, task.id]);

  const focusDescriptionEditor = React.useCallback(() => {
    onSelect(task.id);
    setEditorOpen(true);
    setEditingTitle(false);
    requestAnimationFrame(() => {
      descriptionInputRef.current?.focus();
    });
  }, [onSelect, task.id]);

  const completionRingClassName = task.completed
    ? 'border-primary/80 bg-primary'
    : 'border-muted-foreground/45 bg-transparent group-hover/task:border-primary/45';

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative"
    >
      <AnimatePresence initial={false}>
        {swipeOffset < -8 ? (
          <motion.div
            key="swipe-delete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-y-0 right-0 flex w-20 items-center justify-center"
          >
            <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-destructive/14 text-destructive">
              <Trash2 className="h-4 w-4" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        layout="position"
        animate={{ x: swipeOffset }}
        transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.7 }}
        draggable={false}
        onDragOver={(event) => onTaskDragOverItem(event, sectionId, task.id)}
        onDrop={(event) => onTaskDropToSection(event, sectionId, task.id)}
        onPointerDown={(event) => {
          if (event.button !== 0 || isInteractiveTarget(event.target)) return;
          pointerStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            swiping: false,
          };
        }}
        onPointerMove={(event) => {
          const pointerState = pointerStateRef.current;
          if (!pointerState || pointerState.pointerId !== event.pointerId) return;

          const deltaX = event.clientX - pointerState.startX;
          const deltaY = event.clientY - pointerState.startY;

          if (!pointerState.swiping) {
            if (Math.abs(deltaX) < 6 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
            pointerState.swiping = true;
          }

          if (deltaX > 0) {
            setSwipeOffset(0);
            return;
          }

          setSwipeOffset(Math.max(deltaX, -84));
        }}
        onPointerUp={(event) => {
          const pointerState = pointerStateRef.current;
          if (!pointerState || pointerState.pointerId !== event.pointerId) return;
          if (pointerState.swiping && swipeOffset <= -58) {
            onRequestDelete(task);
          } else if (!pointerState.swiping && !isInteractiveTarget(event.target)) {
            onSelect(task.id);
          }
          pointerStateRef.current = null;
          setSwipeOffset(0);
        }}
        onPointerCancel={() => {
          pointerStateRef.current = null;
          setSwipeOffset(0);
        }}
        onClick={(event) => {
          if (isInteractiveTarget(event.target)) return;
          onSelect(task.id);
        }}
        onFocus={(event) => {
          if (isInteractiveTarget(event.target)) return;
          onSelect(task.id);
        }}
        tabIndex={0}
        className={cn(
          'group/task rounded-[18px] px-3 py-2.5 transition-colors outline-none sm:px-2',
          task.completed ? 'text-muted-foreground' : 'hover:bg-muted/28',
          isSelected && 'bg-muted/40 ring-1 ring-primary/20',
          draggingTaskId === task.id && 'opacity-45',
          dragOverTaskId === task.id && 'before:absolute before:-top-1 before:left-4 before:right-4 before:h-0.5 before:rounded-full before:bg-primary',
        )}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={task.completed}
            aria-label={`Mark ${task.title} as completed`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleTaskCompleted(task.id, !task.completed);
            }}
            className="mt-0.5 flex size-5 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            data-no-swipe="true"
          >
            <motion.span
              initial={false}
              animate={{
                scale: task.completed ? [1, 1.12, 1] : 1,
              }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className={cn(
                'block size-5 rounded-full border transition-colors',
                completionRingClassName,
              )}
            />
          </button>

          <div
            ref={editorRef}
            className="min-w-0 flex-1 space-y-0.5"
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget as HTMLElement | null;
              if (nextTarget && editorRef.current?.contains(nextTarget)) return;
              if (nextTarget?.closest('[data-slot="popover-content"],[data-slot="select-content"]')) return;
              setEditingTitle(false);
              setEditorOpen(false);
            }}
          >
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              size={Math.max(titleDraft.length, task.title.length, 1)}
              readOnly={!editingTitle}
              onChange={(event) => setTitleDraft(event.target.value)}
              onFocus={() => {
                focusTitleEditor();
              }}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitTitle();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setEditingTitle(false);
                  setTitleDraft(task.title);
                }
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(task.id);
              }}
              className={cn(
                'block max-w-full border-0 bg-transparent p-0 text-[16px] font-medium leading-6 outline-none',
                task.completed ? 'text-muted-foreground/88' : 'text-foreground',
                !editingTitle && 'pointer-events-auto cursor-text select-text',
                task.completed && 'line-through decoration-muted-foreground/60',
              )}
              style={{ width: `${Math.max(titleDraft.length, task.title.length, 1)}ch` }}
            />

            {isExpanded ? (
              <>
                <textarea
                  ref={descriptionInputRef}
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  onBlur={commitDescription}
                  placeholder="Notes"
                  rows={descriptionDraft ? Math.min(Math.max(descriptionDraft.split('\n').length, 1), 4) : 1}
                  className={cn(
                    'min-h-0 w-full resize-none border-0 bg-transparent px-0 py-0 shadow-none outline-none placeholder:text-muted-foreground/80',
                    completedTextClassName,
                  )}
                />

                <div className="pt-1">
                  <TodoMetaEditorChips
                    mode={showCourseTag ? mode : 'course'}
                    dueDate={task.dueDate}
                    dueTime={task.dueTime}
                    priority={task.priority}
                    courseId={task.courseId}
                    courseOptions={courseOptions}
                    priorityOptions={priorityOptions}
                    isOverdue={isOverdue}
                    completed={task.completed}
                    onChange={(patch) => {
                      const selectedCourse = patch.courseId
                        ? courseOptions.find((course) => course.id === patch.courseId)
                        : undefined;

                      onPatchTask(task.id, {
                        ...patch,
                        courseName: selectedCourse?.name ?? '',
                        courseCategory: selectedCourse?.category ?? '',
                      });
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                {compactDescription ? (
                  <input
                    type="text"
                    readOnly
                    value={compactDescription}
                    size={Math.max(compactDescription.length, 1)}
                    tabIndex={0}
                    onFocus={focusDescriptionEditor}
                    onClick={(event) => {
                      event.stopPropagation();
                      focusDescriptionEditor();
                    }}
                    className={cn(
                      'block max-w-full border-0 bg-transparent p-0 outline-none',
                      completedTextClassName,
                    )}
                    style={{ width: `${Math.max(compactDescription.length, 1)}ch` }}
                  />
                ) : null}
                {compactMeta.length > 0 ? (
                  <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[14px] leading-[1.25]', task.completed ? 'text-muted-foreground/88' : 'text-muted-foreground/92')}>
                    {compactMeta.map((item) => (
                      item.kind === 'course' ? (
                        <span
                          key={item.key}
                          className={cn(
                            'inline-flex h-4.5 max-w-[8rem] items-center rounded-full px-1.5 text-[11px] font-medium leading-none',
                            item.className,
                          )}
                          style={item.style}
                        >
                          <span className="truncate">{item.label}</span>
                        </span>
                      ) : (
                        <span key={item.key} className={cn('truncate', task.completed ? 'text-muted-foreground/88' : item.className)}>
                          {item.label}
                        </span>
                      )
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="flex items-start gap-1">
            <div
              draggable={!task.completed}
              onDragStart={() => onTaskDragStart(task)}
              onDragEnd={onTaskDragEnd}
              className={cn(
                'hidden cursor-grab rounded-full p-1.5 text-muted-foreground/75 transition-colors md:flex',
                task.completed ? 'pointer-events-none opacity-30 grayscale' : 'hover:bg-muted/50 hover:text-foreground active:cursor-grabbing',
              )}
              aria-label={`Drag ${task.title}`}
              data-no-swipe="true"
            >
              <GripVertical className="h-4 w-4" />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn('h-7 w-7 text-muted-foreground', task.completed ? 'opacity-45 hover:text-muted-foreground' : 'hover:text-foreground')}
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetails(task);
              }}
              aria-label={`Open details for ${task.title}`}
              data-no-swipe="true"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
