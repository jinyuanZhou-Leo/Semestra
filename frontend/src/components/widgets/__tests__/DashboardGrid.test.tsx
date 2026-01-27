import { render, screen } from '@testing-library/react';
import { DashboardGrid } from '../DashboardGrid';
import { vi, describe, it, expect, beforeAll } from 'vitest';

import { WidgetRegistry } from '../../../services/widgetRegistry';
import { Counter } from '../../../plugins/Counter';
import { CourseList } from '../../../plugins/CourseList';

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
        defaultLayout: { w: 3, h: 4 }
    });
    WidgetRegistry.register({
        type: 'course-list',
        name: 'Course List',
        component: CourseList,
        defaultLayout: { w: 6, h: 8 }
    });
});

// Mock RGL
vi.mock('react-grid-layout', () => {
    return {
        WidthProvider: (Comp: any) => Comp,
        Responsive: ({ children }: any) => <div data-testid="rgl-grid">{children}</div>,
    };
});

// Mock child widgets to avoid complexity
vi.mock('../../../plugins/Counter', () => ({
    Counter: () => <div data-testid="counter-widget">Counter</div>
}));
vi.mock('../../../plugins/CourseList', () => ({
    CourseList: () => <div data-testid="course-list-widget">Course List</div>
}));

describe('DashboardGrid', () => {
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
});
