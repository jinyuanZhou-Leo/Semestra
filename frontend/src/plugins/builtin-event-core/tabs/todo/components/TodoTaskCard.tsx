// input:  [Todo task item data, optional drag handlers, mutation callbacks, course badge styles, and display formatters]
// output: [TodoTaskCard React component]
// pos:    [Reminder-inspired task row used across semester aggregate and course-filtered todo views]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Flag, Pencil, Tag, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { TodoTask } from '../types';

interface PriorityMeta {
  className: string;
  label: string;
}

interface TodoTaskCardProps {
  task: TodoTask;
  sectionId: string;
  completedSectionId: string;
  draggingTaskId: string | null;
  showCourseTag: boolean;
  getCourseTagClassName: (category: string) => string;
  onTaskDragStart: (task: TodoTask) => void;
  onTaskDragEnd: () => void;
  onTaskDragOverSection: (event: React.DragEvent<HTMLElement>, targetSectionId: string) => void;
  onTaskDropToSection: (
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => void;
  onToggleTaskCompleted: (taskId: string, completed: boolean) => void;
  onOpenEditTaskDialog: (task: TodoTask) => void;
  onDeleteTask: (taskId: string) => void;
  getPriorityMeta: (priority: TodoTask['priority']) => PriorityMeta;
  formatTaskDue: (task: TodoTask) => string;
}

export const TodoTaskCard: React.FC<TodoTaskCardProps> = ({
  task,
  sectionId,
  completedSectionId,
  draggingTaskId,
  showCourseTag,
  getCourseTagClassName,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDragOverSection,
  onTaskDropToSection,
  onToggleTaskCompleted,
  onOpenEditTaskDialog,
  onDeleteTask,
  getPriorityMeta,
  formatTaskDue,
}) => {
  const priorityMeta = getPriorityMeta(task.priority);
  const isCompletedSection = sectionId === completedSectionId;
  const canEditViaBadge = !isCompletedSection;
  const [nowTimestamp, setNowTimestamp] = React.useState(0);
  const [celebrateChecked, setCelebrateChecked] = React.useState(false);
  const wasCompletedRef = React.useRef(task.completed);
  const celebrateTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setNowTimestamp(Date.now());
  }, []);

  React.useEffect(() => {
    const wasCompleted = wasCompletedRef.current;
    if (!wasCompleted && task.completed) {
      setCelebrateChecked(true);
      if (celebrateTimerRef.current !== null) {
        window.clearTimeout(celebrateTimerRef.current);
      }
      celebrateTimerRef.current = window.setTimeout(() => {
        setCelebrateChecked(false);
        celebrateTimerRef.current = null;
      }, 430);
    }
    wasCompletedRef.current = task.completed;
  }, [task.completed]);

  React.useEffect(() => {
    return () => {
      if (celebrateTimerRef.current !== null) {
        window.clearTimeout(celebrateTimerRef.current);
      }
    };
  }, []);

  const isOverdue = React.useMemo(() => {
    if (task.completed || !task.dueDate || nowTimestamp === 0) return false;
    const dueAt = new Date(`${task.dueDate}T${task.dueTime || '23:59'}:00`);
    if (!Number.isFinite(dueAt.getTime())) return false;
    return dueAt.getTime() < nowTimestamp;
  }, [nowTimestamp, task.completed, task.dueDate, task.dueTime]);

  const handleOpenBadgeSettings = () => {
    if (!canEditViaBadge) return;
    onOpenEditTaskDialog(task);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      draggable={!task.completed}
      onDragStart={() => onTaskDragStart(task)}
      onDragEnd={onTaskDragEnd}
      onDragOver={(event) => onTaskDragOverSection(event, sectionId)}
      onDrop={(event) => onTaskDropToSection(event, sectionId, task.id)}
      className={cn(
        'group/task rounded-2xl border border-border/65 bg-background/95 px-3 py-3 shadow-[0_1px_0_hsl(var(--border)/0.45)] transition-all sm:px-4',
        task.completed ? 'bg-muted/25' : 'hover:border-border hover:bg-card',
        draggingTaskId === task.id && 'opacity-55 blur-[1px]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <motion.div
            animate={celebrateChecked ? { scale: [1, 1.2, 1.2, 0.9, 1] } : { scale: 1 }}
            whileTap={{ scale: 0.84 }}
            transition={{ duration: 0.44, ease: ['easeOut', 'linear', 'easeIn', 'easeOut'], times: [0, 0.3, 0.66, 0.86, 1] }}
            className="relative mt-0.5"
          >
            <AnimatePresence>
              {celebrateChecked ? (
                <motion.span
                  key="checkbox-burst-ring"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[-7px] rounded-full bg-[conic-gradient(from_0deg,#fb7185,#f59e0b,#22c55e,#3b82f6,#a855f7,#fb7185)] [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_0)]"
                  initial={{ opacity: 0.95, scale: 0.72, rotate: 0 }}
                  animate={{
                    opacity: [0.95, 0.45, 0.08, 0],
                    scale: [0.72, 1.08, 1.26, 1.38],
                    rotate: [0, 90, 150, 180],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.32, ease: ['easeOut', 'easeOut', 'easeIn'], times: [0, 0.45, 0.8, 1] }}
                />
              ) : null}
            </AnimatePresence>
            <Checkbox
              checked={task.completed}
              onCheckedChange={(checked) => onToggleTaskCompleted(task.id, checked === true)}
              aria-label={`Mark ${task.title} as completed`}
              className={cn(
                'relative z-10 mt-0.5 size-5 rounded-full',
                celebrateChecked && 'shadow-[0_0_0_4px_hsl(var(--primary)/0.18)]',
              )}
            />
          </motion.div>

          <div className={cn('min-w-0 flex-1 space-y-1.5', task.completed && 'grayscale')}>
            <div className="relative inline-flex max-w-full align-top">
              <p className={cn('truncate text-[17px] font-medium leading-6', task.completed && 'text-muted-foreground')}>
                {task.title}
              </p>
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 bg-muted-foreground/70"
                initial={false}
                animate={{
                  scaleX: task.completed ? 1 : 0,
                  opacity: task.completed ? 1 : 0.5,
                }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                style={{ transformOrigin: 'left center' }}
              />
            </div>

            {task.description ? (
              <p
                className="overflow-hidden text-sm text-muted-foreground"
                title={task.description}
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {task.description}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                asChild
                variant="outline"
                className={cn(
                  'rounded-full border-border/70 bg-muted/40 text-[11px]',
                  isOverdue && 'border-destructive/35 bg-destructive/10 text-destructive',
                  canEditViaBadge && 'cursor-pointer hover:bg-muted',
                )}
              >
                <button type="button" onClick={handleOpenBadgeSettings} aria-label={`Edit due date for ${task.title}`}>
                  <CalendarClock className="mr-1 h-3 w-3" />
                  {formatTaskDue(task)}
                </button>
              </Badge>

              <Badge
                asChild
                className={cn(
                  'rounded-full border text-[11px]',
                  priorityMeta.className,
                  canEditViaBadge && 'cursor-pointer',
                )}
              >
                <button type="button" onClick={handleOpenBadgeSettings} aria-label={`Edit priority for ${task.title}`}>
                  <Flag className="mr-1 h-3 w-3" />
                  {priorityMeta.label}
                </button>
              </Badge>

              {showCourseTag && task.courseId ? (
                <Badge className={cn('rounded-full border-0 text-[11px]', getCourseTagClassName(task.courseCategory))}>
                  <Tag className="mr-1 h-3 w-3" />
                  {task.courseName}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-100 md:pointer-events-none md:opacity-0 md:transition-opacity md:group-hover/task:pointer-events-auto md:group-hover/task:opacity-100 md:group-focus-within/task:pointer-events-auto md:group-focus-within/task:opacity-100">
          {!isCompletedSection ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onOpenEditTaskDialog(task)}
              aria-label={`Edit ${task.title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteTask(task.id)}
            aria-label={`Delete ${task.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
