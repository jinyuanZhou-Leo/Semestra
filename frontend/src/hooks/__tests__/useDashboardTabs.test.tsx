// input:  [dashboard tab hook, mocked runtime-tab reorder APIs, and testing-library hook helpers]
// output: [regression tests covering managed runtime-tab reorder identity preservation]
// pos:    [Hook-level regression tests for homepage tab stability when managed reorder responses differ from optimistic local tab state]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDashboardTabs } from '../useDashboardTabs';

const { apiMock } = vi.hoisted(() => ({
    apiMock: {
        reorderCourseRuntimeTabs: vi.fn(),
        reorderSemesterRuntimeTabs: vi.fn(),
        updateCourseRuntimeTabSettings: vi.fn(),
        updateSemesterRuntimeTabSettings: vi.fn(),
        updateTab: vi.fn(),
    },
}));

vi.mock('../../services/api', () => ({
    default: apiMock,
}));

vi.mock('../../services/appStatus', () => ({
    reportError: vi.fn(),
}));

describe('useDashboardTabs', () => {
    beforeEach(() => {
        apiMock.reorderCourseRuntimeTabs.mockReset();
        apiMock.reorderSemesterRuntimeTabs.mockReset();
        apiMock.updateCourseRuntimeTabSettings.mockReset();
        apiMock.updateSemesterRuntimeTabSettings.mockReset();
        apiMock.updateTab.mockReset();
    });

    it('preserves optimistic tab ids after managed course reorder responses', async () => {
        const initialTabs = [
            {
                id: 'course:1:todo',
                type: 'builtin-todo',
                title: 'Todo',
                settings: {},
                order_index: 0,
                availability: { state: 'available' as const },
            },
            {
                id: 'course:1:gradebook',
                type: 'builtin-gradebook',
                title: 'Gradebook',
                settings: {},
                order_index: 1,
                availability: { state: 'available' as const },
            },
        ];
        apiMock.reorderCourseRuntimeTabs.mockResolvedValue([
            {
                id: 'server-gradebook',
                type: 'builtin-gradebook',
                title: 'Gradebook',
                settings: {},
                order_index: 0,
                availability: { state: 'available' },
            },
            {
                id: 'server-todo',
                type: 'builtin-todo',
                title: 'Todo',
                settings: {},
                order_index: 1,
                availability: { state: 'available' },
            },
        ]);

        const { result, unmount } = renderHook(() => useDashboardTabs({
            courseId: 'course-1',
            initialTabs,
        }));

        expect(result.current.tabs.map((tab) => tab.id)).toEqual([
            'course:1:todo',
            'course:1:gradebook',
        ]);

        act(() => {
            result.current.reorderTabs(['course:1:gradebook', 'course:1:todo']);
        });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        expect(result.current.tabs.map((tab) => tab.id)).toEqual([
            'course:1:gradebook',
            'course:1:todo',
        ]);

        unmount();
    });

    it('keeps existing tabs when the managed reorder response omits non-reorderable entries', async () => {
        const initialTabs = [
            {
                id: 'semester:1:dashboard',
                type: 'builtin-dashboard',
                title: 'Dashboard',
                settings: {},
                order_index: -1,
                is_draggable: false,
                availability: { state: 'available' as const },
            },
            {
                id: 'semester:1:todo',
                type: 'builtin-todo',
                title: 'Todo',
                settings: {},
                order_index: 0,
                availability: { state: 'available' as const },
            },
        ];
        apiMock.reorderSemesterRuntimeTabs.mockResolvedValue([
            {
                id: 'server-todo',
                type: 'builtin-todo',
                title: 'Todo',
                settings: {},
                order_index: 0,
                availability: { state: 'available' },
            },
        ]);

        const { result, unmount } = renderHook(() => useDashboardTabs({
            semesterId: 'semester-1',
            initialTabs,
        }));

        expect(result.current.tabs).toHaveLength(2);

        act(() => {
            result.current.reorderTabs(['semester:1:todo']);
        });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        expect(result.current.tabs.map((tab) => tab.id)).toEqual([
            'semester:1:dashboard',
            'semester:1:todo',
        ]);

        unmount();
    });
});
