// input:  [Vitest assertions, builtin-gradebook shared helpers, and simplified gradebook fixtures]
// output: [test suite validating builtin-gradebook forecast summaries, exact-weight gating, plan-mode recommendations, GPA-threshold resolution, exact-percentage targets, and stable badge color fallbacks]
// pos:    [plugin-level regression tests for the rebuilt gradebook statistical helpers, temporary what-if calculations, exact-100 weight validation, band-aware GPA scale parsing, continuous integer-band matching, exact percentage planning targets, and category badge helpers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import {
    buildComputedGradebookSummary,
    buildPlanModeResult,
    buildSuggestedWhatIfScores,
    calculateGradebookGpa,
    formatGradebookDate,
    getCategoryBadgeClassName,
    getCategoryBadgeStyle,
    hasCompleteGradebookWeight,
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
            points_earned: null,
            points_possible: null,
            order_index: 0,
        },
        {
            id: 'assessment-2',
            category_id: 'category-assignment',
            title: 'Essay 2',
            due_date: '2026-03-12',
            weight: 25,
            score: null,
            points_earned: null,
            points_possible: null,
            order_index: 1,
        },
        {
            id: 'assessment-3',
            category_id: 'category-exam',
            title: 'Final Exam',
            due_date: '2026-04-20',
            weight: 50,
            score: null,
            points_earned: null,
            points_possible: null,
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

    it('maps numeric scaling tables by the matched band minimum', () => {
        expect(calculateGradebookGpa(86, {
            '90': 4.0,
            '85': 3.9,
            '80': 3.7,
            '75': 3.3,
        })).toBe(3.9);
        expect(calculateGradebookGpa(80, {
            '90': 4.0,
            '85': 3.9,
            '80': 3.7,
            '75': 3.3,
        })).toBe(3.7);
        expect(resolveTargetPercentageForGpa(3.7, {
            '90': 4.0,
            '85': 3.9,
            '80': 3.7,
            '75': 3.3,
        })).toBe(80);
    });

    it('treats adjacent integer ranges as continuous percentage bands', () => {
        expect(calculateGradebookGpa(89.5, {
            '90-100': 4.0,
            '85-89': 3.7,
            '0-84': 0.0,
        })).toBe(3.7);
        expect(calculateGradebookGpa(84.5, {
            '90-100': 4.0,
            '85-89': 3.7,
            '0-84': 0.0,
        })).toBe(0.0);
    });

    it('keeps forecast blank when a remaining category has no history', () => {
        const summary = buildComputedGradebookSummary(fixture);

        expect(summary.forecast_percentage).toBeNull();
        expect(summary.missing_history_categories).toContain('Exam');
    });

    it('disables grade calculations when total weight is below 100%', () => {
        const partialWeightFixture: CourseGradebook = {
            ...fixture,
            assessments: fixture.assessments.map((assessment, index) => (
                index === 2
                    ? { ...assessment, weight: 40 }
                    : assessment
            )),
        };

        const summary = buildComputedGradebookSummary(partialWeightFixture);

        expect(hasCompleteGradebookWeight(partialWeightFixture)).toBe(false);
        expect(summary.total_weight).toBe(90);
        expect(summary.has_complete_weight).toBe(false);
        expect(summary.current_real_percentage).toBeNull();
        expect(summary.current_real_gpa).toBeNull();
        expect(summary.minimum_required_average).toBeNull();
        expect(summary.forecast_percentage).toBeNull();
    });

    it('disables grade calculations when total weight exceeds 100%', () => {
        const overweightFixture: CourseGradebook = {
            ...fixture,
            assessments: fixture.assessments.map((assessment, index) => (
                index === 2
                    ? { ...assessment, weight: 60 }
                    : assessment
            )),
        };

        const summary = buildComputedGradebookSummary(overweightFixture);

        expect(hasCompleteGradebookWeight(overweightFixture)).toBe(false);
        expect(summary.total_weight).toBe(110);
        expect(summary.has_complete_weight).toBe(false);
        expect(summary.current_real_percentage).toBeNull();
        expect(summary.current_real_gpa).toBeNull();
        expect(summary.minimum_required_average).toBeNull();
    });

    it('auto mode: adds equal extra effort above each assessment expected score', () => {
        // Fixture: assessment-1 graded (82), assessment-2 same category (pending), assessment-3 different category (pending).
        // Global weighted mean = 82. Expected scores: assessment-2 = 82 (shrunk), assessment-3 = 82 (no history → global mean).
        // Base projection = 20.5 + 20.5 + 41 = 82%. Deficit to 90% = 8%.
        // δ = 8 * 100 / 75 = 10.667 → both get ceil(82 + 10.667) = 93.
        const whatIfScores = buildSuggestedWhatIfScores(fixture, 90);

        expect(whatIfScores['assessment-2']).toBe(93);
        expect(whatIfScores['assessment-3']).toBe(93);
    });

    it('auto mode: all scores are integers (ceiling applied)', () => {
        const whatIfScores = buildSuggestedWhatIfScores(fixture, 90);

        Object.values(whatIfScores).forEach((score) => {
            expect(score).toBe(Math.ceil(score));
        });
    });

    it('auto mode: honors an exact percentage target instead of the GPA band minimum', () => {
        const whatIfScores = buildSuggestedWhatIfScores(fixture, 89);
        const result = buildPlanModeResult(fixture, 3.9, 89, whatIfScores);

        expect(whatIfScores['assessment-2']).toBe(92);
        expect(whatIfScores['assessment-3']).toBe(92);
        expect(result.target_percentage).toBe(89);
        expect(result.projected_percentage).toBe(89.5);
    });

    it('auto mode: lowers expected scores when the target is below the historical baseline', () => {
        const whatIfScores = buildSuggestedWhatIfScores(fixture, 70);
        const result = buildPlanModeResult(fixture, 3.0, 70, whatIfScores);

        expect(whatIfScores['assessment-2']).toBe(66);
        expect(whatIfScores['assessment-3']).toBe(66);
        expect(result.projected_percentage).toBe(70);
        expect(result.target_percentage).toBe(70);
    });

    it('simple_minimum_needed: caps recommended scores at 100 when target is infeasible', () => {
        // With score=0 on assessment-1: current = 0%, requiredAverage = 90/75*100 = 120 → capped to 100.
        const infeasibleFixture: CourseGradebook = {
            ...fixture,
            forecast_model: 'simple_minimum_needed',
            assessments: fixture.assessments.map((assessment) => (
                assessment.id === 'assessment-1' ? { ...assessment, score: 0 } : assessment
            )),
        };
        const whatIfScores = buildSuggestedWhatIfScores(infeasibleFixture, 90);

        expect(whatIfScores['assessment-2']).toBe(100);
        expect(whatIfScores['assessment-3']).toBe(100);
    });

    it('simple_minimum_needed: assigns same score to all pending assessments', () => {
        const simpleFixture: CourseGradebook = { ...fixture, forecast_model: 'simple_minimum_needed' };
        const whatIfScores = buildSuggestedWhatIfScores(simpleFixture, 90);
        const scores = Object.values(whatIfScores);

        expect(new Set(scores).size).toBe(1);
    });

    it('computes a plan-mode projection from temporary what-if scores', () => {
        const whatIfScores = {
            'assessment-2': 90,
            'assessment-3': 94,
        };
        const result = buildPlanModeResult(fixture, 4, 90, whatIfScores);

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
