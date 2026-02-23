// input:  [DashboardGrid component, mocked RGL runtime, registry fixtures and test callbacks]
// output: [test suite covering dashboard layout persistence and breakpoint behavior]
// pos:    [Regression tests for dashboard grid drag/resize/reflow rules]
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
});

// Mock RGL
let latestResponsiveProps: any = null;
vi.mock('react-grid-layout', () => {
    return {
        WidthProvider: (Comp: any) => Comp,
        Responsive: (props: any) => {
            latestResponsiveProps = props;
            return <div data-testid="rgl-grid">{props.children}</div>;
        },
    };
});

// Mock WidthProvider to ensure grid renders with a width
vi.mock('../WidthProvider', () => ({
    WidthProvider: (Comp: any) => (props: any) => <Comp {...props} width={1200} />
}));

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

    it('does not persist responsive reflow layouts via onLayoutChange', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode
            />
        );

        act(() => {
            latestResponsiveProps.onLayoutChange?.([{ i: '1', x: 0, y: 0, w: 5, h: 3 }]);
        });

        expect(onLayoutChange).not.toHaveBeenCalled();
    });

    it('persists layout changes on drag stop while editing', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout = [{ i: '1', x: 0, y: 0, w: 3, h: 4 }];

        act(() => {
            latestResponsiveProps.onDragStop(layout);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutChange).toHaveBeenCalledWith(layout, 'desktop', 12);
    });

    it('persists layout changes on resize stop while editing', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout = [{ i: '1', x: 0, y: 0, w: 4, h: 5 }];

        act(() => {
            latestResponsiveProps.onResizeStop(layout);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutChange).toHaveBeenCalledWith(layout, 'desktop', 12);
    });

    it('persists layout changes to mobile layout when current breakpoint is mobile', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode
            />
        );

        const layout = [{ i: '1', x: 0, y: 2, w: 4, h: 4 }];

        act(() => {
            latestResponsiveProps.onBreakpointChange('sm', 6);
            latestResponsiveProps.onDragStop(layout);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutChange).toHaveBeenCalledWith(layout, 'mobile', 6);
    });

    it('does not persist layouts when edit mode is disabled', () => {
        const widgets = [{ id: '1', type: 'counter', title: 'Counter 1' }];
        const onLayoutChange = vi.fn();

        render(
            <DashboardGrid
                widgets={widgets as any}
                onLayoutChange={onLayoutChange}
                semesterId={'1'}
                isEditMode={false}
            />
        );

        act(() => {
            latestResponsiveProps.onDragStop([{ i: '1', x: 0, y: 0, w: 3, h: 4 }]);
            latestResponsiveProps.onResizeStop([{ i: '1', x: 0, y: 0, w: 3, h: 4 }]);
        });

        expect(onLayoutChange).not.toHaveBeenCalled();
    });
});
