// input:  [Vitest assertions, builtin-gradebook shared helpers, and minimal gradebook fixtures]
// output: [test suite validating builtin-gradebook shared defaults, scenario selection, and client-side summary math]
// pos:    [plugin-level regression tests for shared gradebook view-state normalization and derived calculations]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import {
    buildComputedGradebookSummary,
    DEFAULT_GRADEBOOK_VIEW_SETTINGS,
    formatGradebookDate,
    getSelectedScenarioId,
    normalizeGradebookViewSettings,
} from './shared';
import type { CourseGradebook } from '@/services/api';

const fixture: CourseGradebook = {
    course_id: 'course-1',
    target_mode: 'percentage',
    target_value: 90,
    baseline_scenario_id: 'scenario-2',
    scaling_table: {
        '90-100': 4.0,
        '80-89': 3.7,
        '70-79': 3.0,
        '0-69': 0.0,
    },
    scenarios: [
        { id: 'scenario-1', name: 'Conservative', color_token: 'blue', order_index: 0, is_baseline: false },
        { id: 'scenario-2', name: 'Expected', color_token: 'emerald', order_index: 1, is_baseline: true },
    ],
    categories: [],
    assessments: [
        {
            id: 'assessment-1',
            category_id: null,
            title: 'Final',
            due_date: '2026-04-20',
            weight: 100,
            status: 'planned',
            forecast_mode: 'manual',
            actual_score: null,
            order_index: 0,
            scenario_scores: [
                { scenario_id: 'scenario-1', forecast_score: 84 },
                { scenario_id: 'scenario-2', forecast_score: 92 },
            ],
        },
    ],
};

describe('builtin-gradebook shared helpers', () => {
    it('normalizes unknown view settings to plugin defaults', () => {
        expect(normalizeGradebookViewSettings(undefined)).toEqual(DEFAULT_GRADEBOOK_VIEW_SETTINGS);
    });

    it('prefers saved selected scenario when it still exists', () => {
        const selectedScenarioId = getSelectedScenarioId(fixture, {
            ...DEFAULT_GRADEBOOK_VIEW_SETTINGS,
            selectedScenarioId: 'scenario-1',
        });

        expect(selectedScenarioId).toBe('scenario-1');
    });

    it('falls back to baseline scenario when saved selection is missing', () => {
        const selectedScenarioId = getSelectedScenarioId(fixture, {
            ...DEFAULT_GRADEBOOK_VIEW_SETTINGS,
            selectedScenarioId: 'missing',
        });

        expect(selectedScenarioId).toBe('scenario-2');
    });

    it('formats missing due dates safely', () => {
        expect(formatGradebookDate(null)).toBe('No due date');
    });

    it('derives scenario projections from fact data', () => {
        const summary = buildComputedGradebookSummary(fixture);

        expect(summary.baseline_projected_percentage).toBe(92);
        expect(summary.baseline_required_score).toBe(0);
        expect(summary.scenario_cards).toHaveLength(2);
        expect(summary.upcoming_due_items[0]?.title).toBe('Final');
    });
});
