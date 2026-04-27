// input:  [DashboardGrid component, mocked RGL v2 runtime hooks, registry fixtures, empty-to-first-widget transition coverage, resize-frequency guards, and layout callbacks]
// output: [test suite covering dashboard resize throttling, layout normalization, and split local-sync/commit behavior]
// pos:    [Regression tests for dashboard grid drag/resize/reflow rules, empty-state-first-widget visibility, and stabilized width updates]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { DashboardGrid } from '../DashboardGrid';
import type { WidgetItem } from '../DashboardGrid';
import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

import { WidgetRegistry } from '../../../services/widgetRegistry';
import { Counter } from '../../../plugins/counter/widget';
import { CourseList } from '../../../plugins/course-list/widget';

const widgetLayouts = new Map([
    ['counter', { w: 3, h: 4 }],
    ['course-list', { w: 6, h: 8 }],
    ['constrained', { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 }],
]);

type MockLayoutItem = {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
};

type MockResponsiveProps = {
    children?: ReactNode;
    layouts?: Record<string, MockLayoutItem[]>;
    rowHeight?: number;
    width?: number;
    onLayoutChange?: (layout: MockLayoutItem[]) => void;
    onDragStart?: () => void;
    onDragStop?: (layout: MockLayoutItem[]) => void;
    onResizeStart?: () => void;
    onResizeStop?: (layout: MockLayoutItem[]) => void;
    onBreakpointChange?: (breakpoint: string, cols: number) => void;
};

// Mock ResizeObserver
beforeAll(() => {
    class MockResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
        writable: true,
        value: MockResizeObserver,
    });

    WidgetRegistry.register({
        type: 'counter',
        component: Counter,
    });
    WidgetRegistry.register({
        type: 'course-list',
        component: CourseList,
    });
    WidgetRegistry.register({
        type: 'constrained',
        component: Counter,
    });
});

// Mock RGL
let latestResponsiveProps: MockResponsiveProps | null = null;
let mockContainerWidth = 1201;
vi.mock('react-grid-layout', () => {
    return {
        useContainerWidth: () => ({
            width: mockContainerWidth,
            mounted: true,
            containerRef: { current: null }
        }),
        Responsive: (props: MockResponsiveProps) => {
            latestResponsiveProps = props;
            return <div data-testid="rgl-grid">{props.children}</div>;
        },
    };
});

vi.mock('../../../plugin-system', async () => {
    const actual = await vi.importActual('../../../plugin-system');
    return {
        ...actual,
        getResolvedWidgetLayoutByType: (type: string) => widgetLayouts.get(type),
    };
});

// Mock child widgets to avoid complexity
vi.mock('../../../plugins/counter/widget', () => ({
    Counter: () => <div data-testid="counter-widget">Counter</div>
}));
vi.mock('../../../plugins/course-list/widget', () => ({
    CourseList: () => <div data-testid="course-list-widget">Course List</div>
}));

describe('DashboardGrid', () => {
    beforeEach(() => {
        latestResponsiveProps = null;
        mockContainerWidth = 1201;
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders empty state when no widgets', () => {
        render(
            <DashboardGrid
                widgets={[]}
                onLayoutChange={() => { }}
                semesterId={'1'}
            />
        );
        expect(screen.getByText('No widgets yet')).toBeInTheDocument();
    });

    it('renders the first widget immediately after leaving the empty state', () => {
        const { rerender } = render(
            <DashboardGrid
                widgets={[]}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(screen.getByText('No widgets yet')).toBeInTheDocument();

        rerender(
            <DashboardGrid
                widgets={[{ id: '1', type: 'counter', title: 'Counter 1' }]}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(screen.getByTestId('rgl-grid')).toBeInTheDocument();
        expect(screen.getByTestId('counter-widget')).toBeInTheDocument();
        expect(screen.queryByText('No widgets yet')).not.toBeInTheDocument();
    });

    it('renders widgets', () => {
        const widgets: WidgetItem[] = [
            { id: '1', type: 'counter', title: 'Counter 1' },
            { id: '2', type: 'course-list', title: 'Courses' }
        ];

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
            />
        );

        expect(screen.getByTestId('counter-widget')).toBeInTheDocument();
        expect(screen.getByTestId('course-list-widget')).toBeInTheDocument();
    });

    it('keeps grid unit width and height ratio at 1:1', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];

        const { rerender } = render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(latestResponsiveProps?.rowHeight).toBeCloseTo((1201 - 16 * 11) / 12, 5);

        mockContainerWidth = 768;
        rerender(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );
        expect(latestResponsiveProps?.rowHeight).toBeCloseTo((768 - 16 * 3) / 4, 5);
    });

    it('matches RGL v2 breakpoint thresholds at exact widths', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        mockContainerWidth = 996;

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(latestResponsiveProps?.rowHeight).toBeCloseTo((996 - 16 * 5) / 6, 5);
    });

    it('falls back to a safe grid unit when width is too small', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];

        const { rerender } = render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        mockContainerWidth = 100;
        rerender(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );
        expect(latestResponsiveProps?.rowHeight).toBe(42);
    });

    it('does not render the grid until container width is measurable', () => {
        mockContainerWidth = 0;
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];

        const { rerender } = render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(screen.queryByTestId('rgl-grid')).not.toBeInTheDocument();

        mockContainerWidth = 1201;
        rerender(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(screen.getByTestId('rgl-grid')).toBeInTheDocument();
        expect(latestResponsiveProps?.width).toBe(1201);
    });

    it('places widgets without persisted layout below occupied area on narrow breakpoints', () => {
        const widgets: WidgetItem[] = [
            {
                id: '1',
                type: 'counter',
                title: 'Pinned',
                layout: {
                    mobile: { x: 0, y: 0, w: 2, h: 2 }
                }
            },
            { id: '2', type: 'counter', title: 'New 1' },
            { id: '3', type: 'counter', title: 'New 2' }
        ];

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        const xxsLayout = latestResponsiveProps?.layouts?.xxs ?? [];
        expect(xxsLayout).toHaveLength(3);

        const pinned = xxsLayout.find((item: MockLayoutItem) => item.i === '1');
        const firstNew = xxsLayout.find((item: MockLayoutItem) => item.i === '2');
        const secondNew = xxsLayout.find((item: MockLayoutItem) => item.i === '3');

        expect(pinned).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
        expect(firstNew?.x).toBe(0);
        expect(secondNew?.x).toBe(0);
        expect(firstNew?.y).toBeGreaterThanOrEqual(2);
        expect(secondNew?.y).toBeGreaterThan(firstNew?.y ?? 0);
    });

    it('sanitizes invalid persisted widget layout values', () => {
        const widgets: WidgetItem[] = [
            {
                id: '1',
                type: 'constrained',
                title: 'Constrained',
                layout: {
                    mobile: { x: -8, y: -5, w: 99, h: 0 }
                }
            }
        ];

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        const constrained = latestResponsiveProps?.layouts?.xxs?.[0];
        expect(constrained).toMatchObject({
            x: 0,
            y: 0,
            w: 2,
            h: 2,
            minW: 2,
            maxW: 2,
            minH: 2,
            maxH: 4
        });
    });

    it('does not sync local layout on responsive reflow when user is not interacting', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        act(() => {
            latestResponsiveProps?.onLayoutChange?.([{ i: '1', x: 0, y: 0, w: 5, h: 3 }]);
        });

        expect(onLayoutChange).not.toHaveBeenCalled();
        expect(onLayoutCommit).not.toHaveBeenCalled();
    });

    it('throttles tiny resize deltas and flushes final width after settle delay', () => {
        vi.useFakeTimers();
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();

        const { rerender } = render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(latestResponsiveProps?.width).toBe(1201);

        mockContainerWidth = 1205;
        rerender(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(latestResponsiveProps?.width).toBe(1201);

        act(() => {
            vi.advanceTimersByTime(181);
        });

        expect(latestResponsiveProps?.width).toBe(1205);
    });

    it('updates width immediately when a resize crosses breakpoint boundary', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        mockContainerWidth = 997;

        const { rerender } = render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(latestResponsiveProps?.width).toBe(997);

        mockContainerWidth = 995;
        rerender(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode
            />
        );

        expect(latestResponsiveProps?.width).toBe(995);
    });

    it('persists layout changes on drag stop while editing', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout: MockLayoutItem[] = [{ i: '1', x: 0, y: 0, w: 3, h: 4 }];

        act(() => {
            latestResponsiveProps?.onDragStop?.(layout);
        });

        expect(onLayoutCommit).toHaveBeenCalledTimes(1);
        expect(onLayoutCommit).toHaveBeenCalledWith(layout, 'desktop', 12);
    });

    it('persists layout changes on resize stop while editing', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout: MockLayoutItem[] = [{ i: '1', x: 0, y: 0, w: 4, h: 5 }];

        act(() => {
            latestResponsiveProps?.onResizeStop?.(layout);
        });

        expect(onLayoutCommit).toHaveBeenCalledTimes(1);
        expect(onLayoutCommit).toHaveBeenCalledWith(layout, 'desktop', 12);
    });

    it('persists layout changes to mobile layout when current breakpoint is mobile', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();
        mockContainerWidth = 769;

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout: MockLayoutItem[] = [{ i: '1', x: 0, y: 2, w: 4, h: 4 }];

        act(() => {
            latestResponsiveProps?.onDragStop?.(layout);
        });

        expect(onLayoutCommit).toHaveBeenCalledTimes(1);
        expect(onLayoutCommit).toHaveBeenCalledWith(layout, 'mobile', 6);
    });

    it('persists the initial measured breakpoint without waiting for onBreakpointChange', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();
        mockContainerWidth = 768;

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout: MockLayoutItem[] = [{ i: '1', x: 0, y: 2, w: 4, h: 4 }];

        act(() => {
            latestResponsiveProps?.onDragStop?.(layout);
        });

        expect(onLayoutCommit).toHaveBeenCalledTimes(1);
        expect(onLayoutCommit).toHaveBeenCalledWith(layout, 'mobile', 4);
    });

    it('does not persist layouts when edit mode is disabled', () => {
        const widgets: WidgetItem[] = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode={false}
            />
        );

        act(() => {
            latestResponsiveProps?.onDragStop?.([{ i: '1', x: 0, y: 0, w: 3, h: 4 }]);
            latestResponsiveProps?.onResizeStop?.([{ i: '1', x: 0, y: 0, w: 3, h: 4 }]);
        });

        expect(onLayoutCommit).not.toHaveBeenCalled();
    });
});
