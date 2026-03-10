// input:  [Vitest + Testing Library, builtin-gradebook widget runtime, and mocked gradebook API responses]
// output: [test suite validating builtin-gradebook summary loading and open-tab dispatch behavior]
// pos:    [plugin-level regression tests for the read-only gradebook summary widget]
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
    revision: 7,
    target_mode: 'percentage',
    target_value: 92,
    baseline_scenario_id: 'scenario-expected',
    scenarios: [
        { id: 'scenario-expected', name: 'Expected', color_token: 'emerald', order_index: 0, is_baseline: true },
    ],
    categories: [],
    assessments: [],
    summary: {
        current_actual_percentage: 84.4,
        current_actual_gpa: 3.6,
        baseline_target_mode: 'percentage',
        baseline_target_value: 92,
        baseline_required_score: 94.5,
        baseline_projected_percentage: 88.1,
        baseline_projected_gpa: 3.8,
        remaining_weight: 35,
        feasibility: 'on_track' as const,
        validation_issues: ['Weights do not sum to 100%'],
        formula_breakdown: [],
        scenario_cards: [],
        upcoming_due_items: [
            {
                assessment_id: 'assessment-1',
                title: 'Final Exam',
                due_date: '2026-03-22',
                category_name: 'Exam',
                category_color_token: 'amber',
            },
        ],
    },
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
