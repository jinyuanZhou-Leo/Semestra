// input:  [Testing Library render helpers, todo interaction hooks/components, and normalized todo runtime fixtures]
// output: [Vitest coverage for inline todo creation, local sort persistence, and completed-task display behavior]
// pos:    [Regression test file for todo runtime helpers that protect local sorting, persisted view preferences, and completion bucketing behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TodoInlineCreateRow } from './components/TodoInlineCreateRow';
import { useTodoSectionTasks } from './hooks/useTodoSectionTasks';
import { useTodoViewPreferences } from './hooks/useTodoViewPreferences';
import { PRIORITY_OPTIONS } from './shared';
import type { TodoListModel } from './types';
import { normalizeListStorage } from './utils/todoData';
import { toggleTodoTaskCompletedInStorage } from './utils/todoMutations';

describe('TodoInlineCreateRow', () => {
  it('opens from the placeholder and saves with Enter without showing action buttons', () => {
    const onOpen = vi.fn();
    const onSave = vi.fn();

    render(
      <TodoInlineCreateRow
        mode="semester"
        open={false}
        draft={{
          title: '',
          note: '',
          sectionId: '',
          courseId: '',
          dueDate: '',
          dueTime: '',
          priority: 'MEDIUM',
        }}
        courseOptions={[]}
        priorityOptions={PRIORITY_OPTIONS}
        onOpen={onOpen}
        onDraftChange={vi.fn()}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add a todo/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  it('cancels on blur outside the composer and saves on Enter while open', () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();

    render(
      <>
        <TodoInlineCreateRow
          mode="semester"
          open
          draft={{
            title: 'Draft task',
            note: '',
            sectionId: '',
            courseId: '',
            dueDate: '',
            dueTime: '',
            priority: 'MEDIUM',
          }}
          courseOptions={[]}
          priorityOptions={PRIORITY_OPTIONS}
          onOpen={vi.fn()}
          onDraftChange={vi.fn()}
          onCancel={onCancel}
          onSave={onSave}
        />
        <button type="button">Outside</button>
      </>,
    );

    const input = screen.getByPlaceholderText('Title');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('useTodoSectionTasks', () => {
  it('sorts visible active tasks with the selected view order while keeping completed tasks in their original bucket', () => {
    const activeList: TodoListModel = {
      id: 'semester:test',
      name: 'Todo',
      source: 'semester',
      canManageSections: true,
      showCourseTag: true,
      sections: [
        { id: 'section-a', name: 'Section A', order: 0 },
        { id: 'section-b', name: 'Section B', order: 1 },
        { id: '__completed__', name: 'Completed', order: 2, isSystem: true },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Bravo',
          note: '',
          sectionId: 'section-a',
          originSectionId: undefined,
          courseId: '',
          courseName: '',
          courseCategory: '',
          dueDate: '',
          dueTime: '',
          priority: 'MEDIUM',
          completed: false,
          order: 0,
          createdAt: '2026-03-11T10:00:00.000Z',
          updatedAt: '2026-03-11T10:00:00.000Z',
        },
        {
          id: 'task-4',
          title: 'Alpha',
          note: '',
          sectionId: 'section-a',
          originSectionId: undefined,
          courseId: '',
          courseName: '',
          courseCategory: '',
          dueDate: '',
          dueTime: '',
          priority: 'LOW',
          completed: false,
          order: 2,
          createdAt: '2026-03-11T10:05:00.000Z',
          updatedAt: '2026-03-11T10:05:00.000Z',
        },
        {
          id: 'task-2',
          title: 'Alpha completed later',
          note: '',
          sectionId: '__completed__',
          originSectionId: 'section-b',
          courseId: '',
          courseName: '',
          courseCategory: '',
          dueDate: '2026-03-12',
          dueTime: '',
          priority: 'LOW',
          completed: true,
          order: 5,
          createdAt: '2026-03-11T11:00:00.000Z',
          updatedAt: '2026-03-11T11:00:00.000Z',
        },
        {
          id: 'task-3',
          title: 'Zulu completed earlier',
          note: '',
          sectionId: '__completed__',
          originSectionId: 'section-b',
          courseId: '',
          courseName: '',
          courseCategory: '',
          dueDate: '2026-03-01',
          dueTime: '',
          priority: 'URGENT',
          completed: true,
          order: 1,
          createdAt: '2026-03-11T09:00:00.000Z',
          updatedAt: '2026-03-11T09:00:00.000Z',
        },
      ],
    };

    const { result } = renderHook(() => useTodoSectionTasks({
      activeList,
      sortMode: 'title',
      sortDirection: 'desc',
      showCompleted: true,
      recentCompletedTaskIds: new Set<string>(),
    }));

    const sectionBBuckets = result.current.sectionTasksMap.get('section-b');
    const sectionABuckets = result.current.sectionTasksMap.get('section-a');
    expect(sectionABuckets?.visible.map((task) => task.id)).toEqual(['task-1', 'task-4']);
    expect(sectionBBuckets?.active).toEqual([]);
    expect(sectionBBuckets?.completed.map((task) => task.id)).toEqual(['task-3', 'task-2']);
    expect(result.current.unsectionedTasks.completed).toEqual([]);
  });
});

describe('useTodoViewPreferences', () => {
  it('persists sort preferences in localStorage for the current list scope', () => {
    const { result, unmount } = renderHook(() => useTodoViewPreferences('semester:test'));

    act(() => {
      result.current.setSortMode('priority');
      result.current.setSortDirection('desc');
    });

    unmount();

    const restored = renderHook(() => useTodoViewPreferences('semester:test'));
    expect(restored.result.current.sortMode).toBe('priority');
    expect(restored.result.current.sortDirection).toBe('desc');
  });
});

describe('normalizeListStorage', () => {
  it('preserves empty priority values instead of coercing them back to Medium', () => {
    const normalized = normalizeListStorage({
      sections: [],
      tasks: [
        {
          id: 'task-empty-priority',
          title: 'Task',
          note: '',
          sectionId: '',
          originSectionId: undefined,
          courseId: '',
          courseName: '',
          courseCategory: '',
          dueDate: '',
          dueTime: '',
          priority: '',
          completed: false,
          order: 0,
          createdAt: '2026-03-11T10:00:00.000Z',
          updatedAt: '2026-03-11T10:00:00.000Z',
        },
      ],
    });

    expect(normalized.tasks[0]?.priority).toBe('');
  });

  it('keeps unsectioned completed tasks out of user sections and restores them to no section', () => {
    const normalizedCompleted = normalizeListStorage({
      sections: [
        { id: 'section-a', name: 'Section A', order: 0 },
      ],
      tasks: [
        {
          id: 'task-unsectioned-completed',
          title: 'Task',
          note: '',
          sectionId: '__completed__',
          originSectionId: undefined,
          courseId: '',
          courseName: '',
          courseCategory: '',
          dueDate: '',
          dueTime: '',
          priority: '',
          completed: true,
          order: 0,
          createdAt: '2026-03-11T10:00:00.000Z',
          updatedAt: '2026-03-11T10:00:00.000Z',
        },
      ],
    });

    expect(normalizedCompleted.tasks[0]?.originSectionId).toBeUndefined();

    const restored = toggleTodoTaskCompletedInStorage(
      normalizedCompleted,
      'task-unsectioned-completed',
      false,
      { moveCompletedToCompletedSection: true },
    );

    expect(restored.tasks[0]?.sectionId).toBe('');
    expect(restored.tasks[0]?.originSectionId).toBeUndefined();
  });
});
