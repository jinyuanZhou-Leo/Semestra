// input:  [Task draft state, semester course options, available sections, and save/cancel callbacks]
// output: [TodoTaskDialog React component]
// pos:    [Modal task editor used for explicit create/edit flows alongside the inline composer]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TaskDraft, TodoCourseOption, TodoPriority, TodoPriorityOption, TodoSection } from '../../types';

const EMPTY_PRIORITY_VALUE = '__todo-priority-none__';

interface TodoTaskDialogProps {
  open: boolean;
  editingTaskId: string | null;
  taskDraft: TaskDraft;
  courseOptions: TodoCourseOption[];
  sections: TodoSection[];
  showCourseField: boolean;
  unsectionedBucketId: string;
  unsectionedBucketName: string;
  priorityOptions: TodoPriorityOption[];
  onOpenChange: (open: boolean) => void;
  onTaskDraftChange: (updater: (previous: TaskDraft) => TaskDraft) => void;
  onSave: () => void;
}

export const TodoTaskDialog: React.FC<TodoTaskDialogProps> = ({
  open,
  editingTaskId,
  taskDraft,
  courseOptions,
  sections,
  showCourseField,
  unsectionedBucketId,
  unsectionedBucketName,
  priorityOptions,
  onOpenChange,
  onTaskDraftChange,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="select-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTaskId ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription>Set task details, schedule, and priority.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="todo-task-title">Title</Label>
            <Input
              id="todo-task-title"
              value={taskDraft.title}
              onChange={(event) => onTaskDraftChange((previous) => ({ ...previous, title: event.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="todo-task-description">Description</Label>
            <Textarea
              id="todo-task-description"
              value={taskDraft.description}
              onChange={(event) => onTaskDraftChange((previous) => ({ ...previous, description: event.target.value }))}
              className="max-h-32 resize-none overflow-y-auto"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label>Section</Label>
            <Select
              value={taskDraft.sectionId || unsectionedBucketId}
              onValueChange={(value) => onTaskDraftChange((previous) => ({ ...previous, sectionId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={unsectionedBucketId}>{unsectionedBucketName}</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showCourseField ? (
            <div className="grid gap-2">
              <Label>Course</Label>
              <Select
                value={taskDraft.courseId || '__none__'}
                onValueChange={(value) => onTaskDraftChange((previous) => ({ ...previous, courseId: value === '__none__' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Course</SelectItem>
                  {courseOptions.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="todo-task-date">Date</Label>
              <Input
                id="todo-task-date"
                type="date"
                value={taskDraft.dueDate}
                onChange={(event) => onTaskDraftChange((previous) => ({ ...previous, dueDate: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="todo-task-time">Time</Label>
              <Input
                id="todo-task-time"
                type="time"
                value={taskDraft.dueTime}
                onChange={(event) => onTaskDraftChange((previous) => ({ ...previous, dueTime: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select
              value={taskDraft.priority || EMPTY_PRIORITY_VALUE}
              onValueChange={(value) => onTaskDraftChange((previous) => ({ ...previous, priority: value === EMPTY_PRIORITY_VALUE ? '' : value as TodoPriority }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_PRIORITY_VALUE}>No Priority</SelectItem>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            {editingTaskId ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
