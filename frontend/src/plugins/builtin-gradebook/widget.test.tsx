// input:  [Vitest + Testing Library, builtin-gradebook widget runtime, and mocked gradebook fact responses]
// output: [test suite validating builtin-gradebook summary loading and open-tab dispatch behavior]
// pos:    [plugin-level regression tests for the read-only gradebook summary widget and its client-side projections]
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
    target_mode: 'percentage',
    target_value: 89,
    baseline_scenario_id: 'scenario-expected',
    scaling_table: {
        '90-100': 4.0,
        '80-89': 3.7,
        '70-79': 3.0,
        '0-69': 0.0,
    },
    scenarios: [
        { id: 'scenario-expected', name: 'Expected', color_token: 'emerald', order_index: 0, is_baseline: true },
    ],
    categories: [
        {
            id: 'category-exam',
            name: 'Exam',
            key: 'exam',
            is_builtin: true,
            color_token: 'amber',
            order_index: 0,
            is_archived: false,
        },
    ],
    assessments: [
        {
            id: 'assessment-1',
            category_id: 'category-exam',
            title: 'Final Exam',
            due_date: '2026-03-22',
            weight: 35,
            status: 'planned',
            forecast_mode: 'solver',
            actual_score: null,
            order_index: 0,
            scenario_scores: [
                { scenario_id: 'scenario-expected', forecast_score: null },
            ],
        },
        {
            id: 'assessment-completed',
            category_id: 'category-exam',
            title: 'Midterm',
            due_date: '2026-02-20',
            weight: 65,
            status: 'completed',
            forecast_mode: 'manual',
            actual_score: 84.4,
            order_index: 1,
            scenario_scores: [
                { scenario_id: 'scenario-expected', forecast_score: 84.4 },
            ],
        },
    ],
};

describe('BuiltinGradebookSummaryWidget', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads and renders projected summary details', async () => {
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

        expect(await screen.findByText('Projected')).toBeInTheDocument();
        expect(screen.getByText('Remaining')).toBeInTheDocument();
        expect(screen.getByText('35.00%')).toBeInTheDocument();
        expect(screen.getByText('Final Exam')).toBeInTheDocument();
        expect(screen.getByText('On Track')).toBeInTheDocument();
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

        const button = await screen.findByRole('button', { name: 'Open Gradebook' });
        fireEvent.click(button);

        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
    });
});
