// input:  [Vitest assertions, builtin-gradebook shared helpers, and simplified gradebook fixtures]
// output: [test suite validating builtin-gradebook forecast summaries, category-history logic, plan-mode recommendations, and stable badge color fallbacks]
// pos:    [plugin-level regression tests for the rebuilt gradebook statistical helpers, temporary what-if calculations, and category badge helpers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import {
    buildComputedGradebookSummary,
    buildPlanModeResult,
    buildSuggestedWhatIfScores,
    formatGradebookDate,
    getCategoryBadgeClassName,
    getCategoryBadgeStyle,
    resolveTargetPercentageForGpa,
} from './shared';
import type { CourseGradebook } from '@/services/api';

const fixture: CourseGradebook = {
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
        { id: 'category-assignment', name: 'Assignment', key: 'assignment', is_builtin: true, color_token: 'emerald', order_index: 0, is_archived: false },
        { id: 'category-exam', name: 'Exam', key: 'exam', is_builtin: true, color_token: 'amber', order_index: 1, is_archived: false },
    ],
    assessments: [
        {
            id: 'assessment-1',
            category_id: 'category-assignment',
            title: 'Essay 1',
            due_date: '2026-02-12',
            weight: 25,
            score: 82,
            order_index: 0,
        },
        {
            id: 'assessment-2',
            category_id: 'category-assignment',
            title: 'Essay 2',
            due_date: '2026-03-12',
            weight: 25,
            score: null,
            order_index: 1,
        },
        {
            id: 'assessment-3',
            category_id: 'category-exam',
            title: 'Final Exam',
            due_date: '2026-04-20',
            weight: 50,
            score: null,
            order_index: 2,
        },
    ],
};

describe('builtin-gradebook shared helpers', () => {
    it('formats missing due dates safely', () => {
        expect(formatGradebookDate(null)).toBe('No due date');
    });

    it('resolves a GPA threshold from the scaling table', () => {
        expect(resolveTargetPercentageForGpa(4, fixture.scaling_table)).toBe(90);
    });

    it('keeps forecast blank when a remaining category has no history', () => {
        const summary = buildComputedGradebookSummary(fixture);

        expect(summary.forecast_percentage).toBeNull();
        expect(summary.missing_history_categories).toContain('Exam');
    });

    it('fills auto what-if scores using history and fallback rules', () => {
        const whatIfScores = buildSuggestedWhatIfScores(fixture, 4);

        expect(whatIfScores['assessment-2']).toBeGreaterThanOrEqual(82);
        expect(whatIfScores['assessment-3']).toBeGreaterThanOrEqual(50);
    });

    it('computes a plan-mode projection from temporary what-if scores', () => {
        const whatIfScores = {
            'assessment-2': 90,
            'assessment-3': 94,
        };
        const result = buildPlanModeResult(fixture, 4, whatIfScores);

        expect(result.target_percentage).toBe(90);
        expect(result.projected_percentage).toBe(90);
        expect(result.is_feasible).toBe(true);
    });

    it('falls back unknown category tokens to the slate badge treatment', () => {
        expect(getCategoryBadgeClassName('unknown-token')).toContain('slate');
    });

    it('renders custom hex category badges with adaptive tinted styles', () => {
        expect(getCategoryBadgeStyle('#facc15')).toEqual({
            backgroundColor: 'color-mix(in srgb, #facc15 16%, var(--background))',
            borderColor: 'color-mix(in srgb, #facc15 28%, var(--background))',
            color: 'color-mix(in srgb, #facc15 82%, var(--foreground))',
        });
    });
});
