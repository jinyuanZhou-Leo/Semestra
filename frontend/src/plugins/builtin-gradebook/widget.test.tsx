// input:  [Vitest + Testing Library, builtin-gradebook widget runtime, and mocked course responses]
// output: [test suite validating the CSS-responsive course-metrics widget rendering and context guard behavior]
// pos:    [plugin-level regression tests for the builtin-gradebook course KPI widget]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { type Course } from '@/services/api';
import * as semesterDataContext from '@/contexts/SemesterDataContext';
import { BuiltinGradebookSummaryWidgetDefinition } from './widget';

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return Wrapper;
};

vi.mock('@/contexts/SemesterDataContext', () => ({
    useSemesterData: vi.fn(),
}));

const courseResponse: Course = {
    id: 'course-1',
    name: 'Advanced Writing',
    credits: 3,
    grade_scaled: 3.7,
    grade_percentage: 88,
    program_id: 'program-1',
    runtime: {
        runtime_tabs: [],
        tab_catalog_items: [],
        widget_catalog_items: [],
        enabled_plugin_ids: [],
        enabled_plugins: [],
        available_widget_types: [],
    },
};

describe('BuiltinGradebookSummaryWidget', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: originalMatchMedia,
        });
    });

    it('loads and renders the compact course metrics', async () => {
        vi.spyOn(api, 'getCourse').mockResolvedValue(courseResponse);

        const WidgetComponent = BuiltinGradebookSummaryWidgetDefinition.component;
        render(
            <WidgetComponent
                widgetId="gradebook-summary-1"
                courseId="course-1"
                settings={{}}
                updateSettings={vi.fn()}
            />,
            { wrapper: createWrapper() },
        );

        expect(await screen.findByText('Credits')).toBeInTheDocument();
        expect(screen.getAllByText('3.00').length).toBeGreaterThan(0);
        expect(screen.getByText('GPA')).toBeInTheDocument();
        expect(screen.getAllByText('3.70').length).toBeGreaterThan(0);
        expect(screen.getByText('GPA Percentage')).toBeInTheDocument();
        expect(screen.getAllByText('88.0%').length).toBeGreaterThan(0);
    });

    it('shows the course-context guard when no course id is available', async () => {
        const WidgetComponent = BuiltinGradebookSummaryWidgetDefinition.component;
        render(
            <WidgetComponent
                widgetId="gradebook-summary-2"
                settings={{}}
                updateSettings={vi.fn()}
            />,
        );

        expect(await screen.findByText('Gradebook unavailable')).toBeInTheDocument();
        expect(screen.getByText('This widget requires a course or semester context.')).toBeInTheDocument();
    });

    it('renders semester metrics from semester data', async () => {
        vi.mocked(semesterDataContext.useSemesterData).mockReturnValue({
            semester: {
                id: 'semester-1',
                name: 'Winter 2026',
                average_scaled: 0,
                average_percentage: 0,
                program_id: 'program-1',
                courses: [
                    {
                        ...courseResponse,
                        id: 'course-1',
                        credits: 3,
                        grade_scaled: 4,
                        grade_percentage: 90,
                        include_in_gpa: true,
                    },
                    {
                        ...courseResponse,
                        id: 'course-2',
                        credits: 1,
                        grade_scaled: 3,
                        grade_percentage: 80,
                        include_in_gpa: true,
                    },
                ],
                runtime: {
                    runtime_tabs: [],
                    tab_catalog_items: [],
                    widget_catalog_items: [],
                    enabled_plugin_ids: [],
                    enabled_plugins: [],
                    available_widget_types: [],
                },
            },
            setSemester: vi.fn(),
            updateSemester: vi.fn(),
            saveSemester: vi.fn(),
            refreshSemester: vi.fn(),
            isLoading: false,
        });

        const WidgetComponent = BuiltinGradebookSummaryWidgetDefinition.component;
        render(
            <WidgetComponent
                widgetId="gradebook-summary-3"
                semesterId="semester-1"
                settings={{}}
                updateSettings={vi.fn()}
            />,
        );

        expect(await screen.findByText('Credits')).toBeInTheDocument();
        expect(screen.getByText('4.00')).toBeInTheDocument();
        expect(screen.getByText('3.75')).toBeInTheDocument();
        expect(screen.getByText('87.5%')).toBeInTheDocument();
    });
});
