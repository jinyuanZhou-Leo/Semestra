// input:  [Vitest + Testing Library, builtin-gradebook widget runtime, and mocked simplified gradebook responses]
// output: [test suite validating rebuilt gradebook widget loading and open-tab dispatch behavior]
// pos:    [plugin-level regression tests for the gradebook summary widget after the real-score-first refactor]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { type CourseGradebook } from '@/services/api';
import { BuiltinGradebookSummaryWidgetDefinition } from './widget';

const gradebookResponse: CourseGradebook = {
    course_id: 'course-1',
    target_gpa: 4,
    forecast_model: 'auto',
    scaling_table: {
        '90-100': 4.0,
        '80-89': 3.7,
        '70-79': 3.0,
        '0-69': 0.0,
    },
    categories: [
        {
            id: 'category-assignment',
            name: 'Assignment',
            key: 'assignment',
            is_builtin: true,
            color_token: 'emerald',
            order_index: 0,
            is_archived: false,
        },
    ],
    assessments: [
        {
            id: 'assessment-1',
            category_id: 'category-assignment',
            title: 'Essay 1',
            due_date: '2026-03-22',
            weight: 40,
            score: 88,
            order_index: 0,
        },
        {
            id: 'assessment-2',
            category_id: 'category-assignment',
            title: 'Essay 2',
            due_date: '2026-04-02',
            weight: 60,
            score: null,
            order_index: 1,
        },
    ],
};

describe('BuiltinGradebookSummaryWidget', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads and renders rebuilt summary details', async () => {
        vi.spyOn(api, 'getCourseGradebook').mockResolvedValue(gradebookResponse);

        const WidgetComponent = BuiltinGradebookSummaryWidgetDefinition.component;
        render(
            <WidgetComponent
                widgetId="gradebook-summary-1"
                courseId="course-1"
                settings={{}}
                updateSettings={vi.fn()}
            />,
        );

        expect(await screen.findByText('Gradebook Snapshot')).toBeInTheDocument();
        expect(screen.getAllByText('Current').length).toBeGreaterThan(0);
        expect(screen.getByText('Forecast Ready')).toBeInTheDocument();
        expect(screen.getByText('Next Due')).toBeInTheDocument();
        expect(screen.getByText('Essay 2')).toBeInTheDocument();
    });

    it('dispatches the open-gradebook event from the CTA button', async () => {
        vi.spyOn(api, 'getCourseGradebook').mockResolvedValue(gradebookResponse);
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        const WidgetComponent = BuiltinGradebookSummaryWidgetDefinition.component;
        render(
            <WidgetComponent
                widgetId="gradebook-summary-2"
                courseId="course-1"
                settings={{}}
                updateSettings={vi.fn()}
            />,
        );

        const button = await screen.findByRole('button', { name: /open gradebook/i });
        fireEvent.click(button);

        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
    });
});
