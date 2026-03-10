// input:  [Vitest assertions, builtin-gradebook shared helpers, and minimal gradebook fixtures]
// output: [test suite validating builtin-gradebook shared defaults and scenario selection helpers]
// pos:    [plugin-level regression tests for shared gradebook view-state normalization and formatting]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import {
    DEFAULT_GRADEBOOK_VIEW_SETTINGS,
    formatGradebookDate,
    getSelectedScenarioId,
    normalizeGradebookViewSettings,
} from './shared';
import type { CourseGradebook } from '@/services/api';

const fixture: CourseGradebook = {
    course_id: 'course-1',
    revision: 3,
    target_mode: 'percentage',
    target_value: 90,
    baseline_scenario_id: 'scenario-2',
    scenarios: [
        { id: 'scenario-1', name: 'Conservative', color_token: 'blue', order_index: 0, is_baseline: false },
        { id: 'scenario-2', name: 'Expected', color_token: 'emerald', order_index: 1, is_baseline: true },
    ],
    categories: [],
    assessments: [],
    summary: {
        current_actual_percentage: 83,
        current_actual_gpa: 3.7,
        baseline_target_mode: 'percentage',
        baseline_target_value: 90,
        baseline_required_score: 92,
        baseline_projected_percentage: 88,
        baseline_projected_gpa: 3.9,
        remaining_weight: 20,
        feasibility: 'on_track',
        validation_issues: [],
        formula_breakdown: [],
        scenario_cards: [],
        upcoming_due_items: [],
    },
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
});
