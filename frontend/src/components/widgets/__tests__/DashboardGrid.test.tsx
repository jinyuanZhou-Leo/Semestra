// input:  [DashboardGrid component, mocked RGL v2 runtime hooks, registry fixtures and layout callbacks]
// output: [test suite covering dashboard local layout sync + commit persistence behavior]
// pos:    [Regression tests for dashboard grid drag/resize/reflow rules with split sync and commit flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, render, screen } from '@testing-library/react';
import { DashboardGrid } from '../DashboardGrid';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { WidgetRegistry } from '../../../services/widgetRegistry';
import { Counter } from '../../../plugins/counter';
import { CourseList } from '../../../plugins/course-list';

// Mock ResizeObserver
beforeAll(() => {
    (globalThis as any).ResizeObserver = class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    };

    WidgetRegistry.register({
        type: 'counter',
        name: 'Counter',
        component: Counter,
        layout: { w: 3, h: 4 }
    });
    WidgetRegistry.register({
        type: 'course-list',
        name: 'Course List',
        component: CourseList,
        layout: { w: 6, h: 8 }
    });
    WidgetRegistry.register({
        type: 'constrained',
        name: 'Constrained',
        component: Counter,
        layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 }
    });
    WidgetRegistry.register({
        type: 'ratio-locked',
        name: 'Ratio Locked',
        component: Counter,
        layout: { w: 4, h: 3, minW: 2, minH: 1, maxW: 6, maxH: 6, aspectRatio: 16 / 9 }
    });
});

// Mock RGL
let latestResponsiveProps: any = null;
vi.mock('react-grid-layout', () => {
    return {
        useContainerWidth: () => ({
            width: 1200,
            mounted: true,
            containerRef: { current: null }
        }),
        Responsive: (props: any) => {
            latestResponsiveProps = props;
            return <div data-testid="rgl-grid">{props.children}</div>;
        },
    };
});

// Mock child widgets to avoid complexity
vi.mock('../../../plugins/counter', () => ({
    Counter: () => <div data-testid="counter-widget">Counter</div>
}));
vi.mock('../../../plugins/course-list', () => ({
    CourseList: () => <div data-testid="course-list-widget">Course List</div>
}));

describe('DashboardGrid', () => {
    beforeEach(() => {
        latestResponsiveProps = null;
    });

    it('renders empty state when no widgets', () => {
        render(
            <DashboardGrid
                widgets={[]}
                onLayoutChange={() => { }}
                semesterId={'1'}
            />
        );
        expect(screen.getByText('No Widgets')).toBeInTheDocument();
    });

    it('renders widgets', () => {
        const widgets = [
            { id: '1', type: 'counter', title: 'Counter 1' },
            { id: '2', type: 'course-list', title: 'Courses' }
        ];

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={() => { }}
                semesterId={'1'}
            />
        );

        expect(screen.getByTestId('counter-widget')).toBeInTheDocument();
        expect(screen.getByTestId('course-list-widget')).toBeInTheDocument();
    });

    it('keeps grid unit width and height ratio at 1:1', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        act(() => {
            latestResponsiveProps.onWidthChange(1200, [16, 16], 12);
        });
        expect(latestResponsiveProps.rowHeight).toBeCloseTo((1200 - 16 * 11) / 12, 5);

        act(() => {
            latestResponsiveProps.onWidthChange(768, [16, 16], 6);
        });
        expect(latestResponsiveProps.rowHeight).toBeCloseTo((768 - 16 * 5) / 6, 5);
    });

    it('falls back to a safe grid unit when width is too small', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        act(() => {
            latestResponsiveProps.onWidthChange(0, [16, 16], 12);
        });
        expect(latestResponsiveProps.rowHeight).toBe(85);

        act(() => {
            latestResponsiveProps.onWidthChange(100, [16, 16], 12);
        });
        expect(latestResponsiveProps.rowHeight).toBe(85);
    });

    it('places widgets without persisted layout below occupied area on narrow breakpoints', () => {
        const widgets = [
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
                widgets={widgets as any}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        const xxsLayout = latestResponsiveProps.layouts?.xxs ?? [];
        expect(xxsLayout).toHaveLength(3);

        const pinned = xxsLayout.find((item: any) => item.i === '1');
        const firstNew = xxsLayout.find((item: any) => item.i === '2');
        const secondNew = xxsLayout.find((item: any) => item.i === '3');

        expect(pinned).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
        expect(firstNew?.x).toBe(0);
        expect(secondNew?.x).toBe(0);
        expect(firstNew?.y).toBeGreaterThanOrEqual(2);
        expect(secondNew?.y).toBeGreaterThan(firstNew?.y ?? 0);
    });

    it('sanitizes invalid persisted widget layout values', () => {
        const widgets = [
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
                widgets={widgets as any}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        const constrained = latestResponsiveProps.layouts?.xxs?.[0];
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

    it('normalizes layout to optional aspect ratio when widget defines aspectRatio', () => {
        const widgets = [
            {
                id: '1',
                type: 'ratio-locked',
                title: 'Ratio',
                layout: {
                    mobile: { x: 0, y: 0, w: 2, h: 6 }
                }
            }
        ];

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={() => { }}
                semesterId={'1'}
                isEditMode
            />
        );

        const ratioWidget = latestResponsiveProps.layouts?.xxs?.[0];
        expect(ratioWidget).toMatchObject({
            x: 0,
            y: 0,
            w: 2,
            h: 1
        });
    });

    it('syncs local layout on responsive reflow without committing persistence', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        act(() => {
            latestResponsiveProps.onLayoutChange?.([{ i: '1', x: 0, y: 0, w: 5, h: 3 }]);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutChange).toHaveBeenCalledWith([{ i: '1', x: 0, y: 0, w: 5, h: 3 }], 'desktop', 12);
        expect(onLayoutCommit).not.toHaveBeenCalled();
    });

    it('persists layout changes on drag stop while editing', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout = [{ i: '1', x: 0, y: 0, w: 3, h: 4 }];

        act(() => {
            latestResponsiveProps.onDragStop(layout);
        });

        expect(onLayoutCommit).toHaveBeenCalledTimes(1);
        expect(onLayoutCommit).toHaveBeenCalledWith(layout, 'desktop', 12);
    });

    it('persists layout changes on resize stop while editing', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout = [{ i: '1', x: 0, y: 0, w: 4, h: 5 }];

        act(() => {
            latestResponsiveProps.onResizeStop(layout);
        });

        expect(onLayoutCommit).toHaveBeenCalledTimes(1);
        expect(onLayoutCommit).toHaveBeenCalledWith(layout, 'desktop', 12);
    });

    it('persists layout changes to mobile layout when current breakpoint is mobile', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout = [{ i: '1', x: 0, y: 2, w: 4, h: 4 }];

        act(() => {
            latestResponsiveProps.onBreakpointChange('sm', 6);
            latestResponsiveProps.onDragStop(layout);
        });

        expect(onLayoutCommit).toHaveBeenCalledTimes(1);
        expect(onLayoutCommit).toHaveBeenCalledWith(layout, 'mobile', 6);
    });

    it('does not persist layouts when edit mode is disabled', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();
        const onLayoutCommit = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                onLayoutCommit={onLayoutCommit}
                semesterId={'1'}
                isEditMode={false}
            />
        );

        act(() => {
            latestResponsiveProps.onDragStop([{ i: '1', x: 0, y: 0, w: 3, h: 4 }]);
            latestResponsiveProps.onResizeStop([{ i: '1', x: 0, y: 0, w: 3, h: 4 }]);
        });

        expect(onLayoutCommit).not.toHaveBeenCalled();
    });
});
