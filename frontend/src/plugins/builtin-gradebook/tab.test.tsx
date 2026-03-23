// input:  [Vitest + Testing Library, builtin-gradebook tab runtime, plugin runtime scope, mocked course and gradebook hooks, and dialog-backed plan-mode UI]
// output: [regression tests validating persisted gradebook plan-mode, What If UI-state, and assessment view preferences restoration]
// pos:    [plugin-level regression tests for builtin-gradebook tab-local UI-state persistence]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogProvider } from '@/contexts/DialogContext';
import * as courseDataContext from '@/contexts/CourseDataContext';
import * as courseGradebookQuery from '@/hooks/useCourseGradebookQuery';
import { PluginRuntimeInstanceProvider, resetPluginUiStateCacheForTests } from '@/plugin-system';
import api, { type CourseGradebook, type GradebookAssessment, type GradebookAssessmentCategory } from '@/services/api';
import { BuiltinGradebookTabDefinition } from './tab';

vi.mock('@/contexts/CourseDataContext', () => ({
    useCourseData: vi.fn(),
}));

vi.mock('@/hooks/useCourseGradebookQuery', () => ({
    useCourseGradebookQuery: vi.fn(),
    useCourseGradebookMutation: vi.fn(),
}));

const categories: GradebookAssessmentCategory[] = [
    {
        id: 'category-1',
        name: 'Assignments',
        key: 'assignments',
        is_builtin: true,
        color_token: 'blue',
        order_index: 0,
        is_archived: false,
    },
];

const assessments: GradebookAssessment[] = [
    {
        id: 'assessment-1',
        category_id: 'category-1',
        title: 'Essay 1',
        due_date: '2026-03-30',
        weight: 40,
        score: null,
        points_earned: null,
        points_possible: null,
        order_index: 0,
    },
    {
        id: 'assessment-2',
        category_id: 'category-1',
        title: 'Essay 2',
        due_date: '2026-04-10',
        weight: 60,
        score: null,
        points_earned: null,
        points_possible: null,
        order_index: 1,
    },
];

const gradebook: CourseGradebook = {
    course_id: 'course-1',
    target_gpa: 3.7,
    forecast_model: 'auto',
    scaling_table: {
        '90': 4.0,
        '85': 3.9,
        '80': 3.7,
        '75': 3.3,
    },
    categories,
    assessments,
};

const renderGradebookTab = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    const TabComponent = BuiltinGradebookTabDefinition.component;

    return render(
        <QueryClientProvider client={queryClient}>
            <DialogProvider>
                <PluginRuntimeInstanceProvider
                    value={{
                        workspaceKind: 'course',
                        workspaceId: 'course-1',
                        slotKind: 'tab',
                        slotId: 'gradebook-tab',
                        pluginType: 'builtin-gradebook',
                    }}
                >
                    <TabComponent
                        tabId="gradebook-tab"
                        courseId="course-1"
                        settings={{}}
                        updateSettings={vi.fn()}
                    />
                </PluginRuntimeInstanceProvider>
            </DialogProvider>
        </QueryClientProvider>,
    );
};

const buildGradebook = (overrides: Partial<CourseGradebook> = {}): CourseGradebook => ({
    ...gradebook,
    ...overrides,
    categories: overrides.categories ?? gradebook.categories,
    assessments: overrides.assessments ?? gradebook.assessments,
});

describe('BuiltinGradebookTab', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        resetPluginUiStateCacheForTests();
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
        vi.spyOn(api, 'getCourseLmsLink').mockResolvedValue(null);
        vi.mocked(courseDataContext.useCourseData).mockReturnValue({
            course: {
                id: 'course-1',
                name: 'Advanced Writing',
                credits: 3,
                grade_scaled: 3.65,
                grade_percentage: 86,
                program_id: 'program-1',
                semester_id: 'semester-1',
                hide_gpa: false,
            },
            setCourse: vi.fn(),
            updateCourse: vi.fn(),
            saveCourse: vi.fn(),
            refreshCourse: vi.fn(),
            isLoading: false,
        });
        vi.mocked(courseGradebookQuery.useCourseGradebookQuery).mockReturnValue({
            data: gradebook,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof courseGradebookQuery.useCourseGradebookQuery>);
        vi.mocked(courseGradebookQuery.useCourseGradebookMutation).mockReturnValue({
            mutateAsync: vi.fn(),
        } as unknown as ReturnType<typeof courseGradebookQuery.useCourseGradebookMutation>);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: originalMatchMedia,
        });
    });

    it('restores persisted plan mode and What If drafts after remount', async () => {
        const firstRender = renderGradebookTab();

        fireEvent.click(screen.getByLabelText('Toggle Plan Mode'));
        fireEvent.click(await screen.findByRole('button', { name: 'Enter Plan Mode' }));

        await waitFor(() => {
            expect(screen.getByDisplayValue('3.7')).toBeInTheDocument();
        });

        const whatIfInputs = screen.getAllByPlaceholderText('What if');
        fireEvent.change(whatIfInputs[0]!, { target: { value: '92' } });

        firstRender.unmount();

        renderGradebookTab();

        await waitFor(() => {
            expect(screen.getByDisplayValue('92')).toBeInTheDocument();
        });
        expect(screen.getByDisplayValue('3.7')).toBeInTheDocument();
        expect(screen.getAllByPlaceholderText('What if')).toHaveLength(2);
    });

    it('restores persisted assessment search and sort preferences after remount', async () => {
        const sortedGradebook = buildGradebook({
            assessments: [
                {
                    ...assessments[0]!,
                    title: 'Zeta Essay',
                    due_date: '2026-03-30',
                },
                {
                    ...assessments[1]!,
                    title: 'Alpha Essay',
                    due_date: '2026-04-10',
                },
            ],
        });

        vi.mocked(courseGradebookQuery.useCourseGradebookQuery).mockReturnValue({
            data: sortedGradebook,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof courseGradebookQuery.useCourseGradebookQuery>);

        const firstRender = renderGradebookTab();

        fireEvent.change(screen.getByPlaceholderText('Search assessments...'), { target: { value: 'essay' } });
        fireEvent.click(screen.getByText('Assessment'));

        await waitFor(() => {
            const assessmentRows = screen.getAllByRole('row').slice(1);
            expect(assessmentRows[0]).toHaveTextContent('Alpha Essay');
            expect(screen.getByDisplayValue('essay')).toBeInTheDocument();
        });

        firstRender.unmount();

        renderGradebookTab();

        await waitFor(() => {
            const assessmentRows = screen.getAllByRole('row').slice(1);
            expect(assessmentRows[0]).toHaveTextContent('Alpha Essay');
            expect(screen.getByDisplayValue('essay')).toBeInTheDocument();
        });
    });
});
