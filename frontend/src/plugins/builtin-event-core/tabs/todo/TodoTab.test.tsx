// input:  [Testing Library render helpers, todo interaction hooks/components, and normalized todo runtime fixtures]
// output: [Vitest coverage for local inline todo creation state, compact time-chip editing, local sort persistence, and completed-task display behavior]
// pos:    [Regression test file for todo runtime helpers that protect per-composer inline drafts, stable shell reuse, persisted view preferences, and completion bucketing behavior]
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
    render(
      <TodoInlineCreateRow
        mode="semester"
        sectionId=""
        courseOptions={[]}
        priorityOptions={PRIORITY_OPTIONS}
        onSave={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByPlaceholderText('Add a todo'));
    expect(screen.getByRole('button', { name: /time/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  it('reuses the same row shell and title field when opening from the placeholder state', () => {
    const { container } = render(
      <TodoInlineCreateRow
        mode="semester"
        sectionId=""
        courseOptions={[]}
        priorityOptions={PRIORITY_OPTIONS}
        onSave={vi.fn()}
      />,
    );

    const shellBeforeOpen = container.querySelector('[data-todo-inline-create-root="true"]');
    const titleFieldBeforeOpen = screen.getByPlaceholderText('Add a todo');

    fireEvent.focus(titleFieldBeforeOpen);

    const shellAfterOpen = container.querySelector('[data-todo-inline-create-root="true"]');
    const titleFieldAfterOpen = screen.getByLabelText('Todo title');

    expect(shellAfterOpen).toBe(shellBeforeOpen);
    expect(titleFieldAfterOpen).toBe(titleFieldBeforeOpen);
  });

  it('saves the entered title on Enter while open', async () => {
    const onSave = vi.fn();

    render(
      <>
        <TodoInlineCreateRow
          mode="semester"
          sectionId=""
          courseOptions={[]}
          priorityOptions={PRIORITY_OPTIONS}
          onSave={onSave}
        />
        <button type="button">Outside</button>
      </>,
    );

    const input = screen.getByPlaceholderText('Add a todo');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Draft task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Draft task' }));
  });

  it('creates the task on blur when the draft already has a title', () => {
    const onSave = vi.fn();

    render(
      <>
        <TodoInlineCreateRow
          mode="semester"
          sectionId=""
          courseOptions={[]}
          priorityOptions={PRIORITY_OPTIONS}
          onSave={onSave}
        />
        <button type="button">Outside</button>
      </>,
    );

    const input = screen.getByPlaceholderText('Add a todo');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Draft task' } });
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Draft task' }));
  });

  it('drops the composer on blur when the draft is still empty', () => {
    const onSave = vi.fn();

    render(
      <>
        <TodoInlineCreateRow
          mode="semester"
          sectionId=""
          courseOptions={[]}
          priorityOptions={PRIORITY_OPTIONS}
          onSave={onSave}
        />
        <button type="button">Outside</button>
      </>,
    );

    const input = screen.getByPlaceholderText('Add a todo');
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Add a todo')).toBeInTheDocument();
  });

  it('keeps the compact time editor left-aligned while editing', () => {
    render(
      <TodoInlineCreateRow
        mode="semester"
        sectionId=""
        courseOptions={[]}
        priorityOptions={PRIORITY_OPTIONS}
        onSave={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByPlaceholderText('Add a todo'));
    fireEvent.click(screen.getByRole('button', { name: /time/i }));

    const timeInput = document.querySelector('input[type="time"]');
    expect(timeInput).not.toBeNull();

    const timeEditor = timeInput?.parentElement;
    expect(timeEditor).not.toBeNull();
    expect(timeEditor).toHaveClass('justify-start');
    expect(timeEditor).not.toHaveClass('justify-between');
    expect(timeEditor).not.toHaveClass('min-w-[92px]');
  });

  it('keeps drafts isolated between multiple inline composers', () => {
    render(
      <>
        <TodoInlineCreateRow
          mode="semester"
          sectionId=""
          placeholder="Add first todo"
          courseOptions={[]}
          priorityOptions={PRIORITY_OPTIONS}
          onSave={vi.fn()}
        />
        <TodoInlineCreateRow
          mode="semester"
          sectionId="section-b"
          placeholder="Add second todo"
          courseOptions={[]}
          priorityOptions={PRIORITY_OPTIONS}
          onSave={vi.fn()}
        />
      </>,
    );

    const firstInput = screen.getByPlaceholderText('Add first todo');
    fireEvent.focus(firstInput);
    fireEvent.change(firstInput, { target: { value: 'First draft' } });

    const secondInput = screen.getByPlaceholderText('Add second todo');
    expect(secondInput).toHaveValue('');
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
