// input:  [gradebook API contracts, date-fns helpers, and builtin-gradebook table view preferences]
// output: [builtin-gradebook constants, forecast/plan calculators, and shared formatters]
// pos:    [shared gradebook domain layer used by the rebuilt builtin-gradebook tab, widget, and settings surface]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { format, formatDistanceToNowStrict, isValid, parseISO, startOfDay } from 'date-fns';
import type React from 'react';
import type {
    CourseGradebook,
    GradebookAssessment,
    GradebookAssessmentCategory,
    GradebookForecastModel,
    GradebookScalingTable,
} from '@/services/api';

export const BUILTIN_GRADEBOOK_PLUGIN_ID = 'builtin-gradebook';
export const BUILTIN_GRADEBOOK_TAB_TYPE = 'builtin-gradebook';
export const BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE = 'builtin-gradebook-summary';
export const GRADEBOOK_OPEN_TAB_EVENT = 'semestra:open-course-gradebook-tab';
export const OPEN_GRADEBOOK_TAB_EVENT = GRADEBOOK_OPEN_TAB_EVENT;

export type GradebookSortKey = 'due_date' | 'category' | 'weight' | 'score' | 'title';
export type GradebookSortDirection = 'asc' | 'desc' | 'none';
export type GradebookFilterKey = 'all' | 'graded' | 'ungraded';

export interface GradebookViewSettings {
    sortKey: GradebookSortKey;
    sortDirection: GradebookSortDirection;
    filter: GradebookFilterKey;
}

export interface OpenGradebookTabDetail {
    courseId?: string;
    tabType: string;
}

export interface GradebookCategoryStats {
    categoryId: string | null;
    categoryName: string;
    sampleCount: number;
    meanScore: number | null;
    standardDeviation: number | null;
    hasHistory: boolean;
}

export interface ComputedGradebookUpcomingDueItem {
    assessment_id: string;
    title: string;
    due_date: string;
    category_name: string | null;
    category_color_token: string | null;
}

export interface ComputedGradebookSummary {
    current_real_percentage: number;
    current_real_gpa: number;
    forecast_percentage: number | null;
    forecast_gpa: number | null;
    minimum_required_average: number | null;
    target_gpa: number;
    target_percentage: number | null;
    remaining_weight: number;
    graded_count: number;
    ungraded_count: number;
    forecast_model: GradebookForecastModel;
    missing_history_categories: string[];
    category_stats: GradebookCategoryStats[];
    upcoming_due_items: ComputedGradebookUpcomingDueItem[];
}

export interface ComputedPlanModeResult {
    recommended_scores: Record<string, number>;
    projected_percentage: number;
    projected_gpa: number;
    target_gpa: number;
    target_percentage: number | null;
    required_average: number | null;
    remaining_weight: number;
    is_feasible: boolean;
    shortfall_percentage: number;
}

export const DEFAULT_GRADEBOOK_VIEW_SETTINGS: GradebookViewSettings = {
    sortKey: 'due_date',
    sortDirection: 'asc',
    filter: 'all',
};

export const CATEGORY_COLOR_OPTIONS = [
    { value: 'emerald', label: 'Emerald', badgeClassName: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800/60', swatchClassName: 'bg-emerald-500' },
    { value: 'blue', label: 'Blue', badgeClassName: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-800/60', swatchClassName: 'bg-blue-500' },
    { value: 'amber', label: 'Amber', badgeClassName: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800/60', swatchClassName: 'bg-amber-500' },
    { value: 'violet', label: 'Violet', badgeClassName: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-100 dark:border-violet-800/60', swatchClassName: 'bg-violet-500' },
    { value: 'rose', label: 'Rose', badgeClassName: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-800/60', swatchClassName: 'bg-rose-500' },
    { value: 'slate', label: 'Slate', badgeClassName: 'bg-slate-200/80 text-slate-800 border-slate-300 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-700', swatchClassName: 'bg-slate-500' },
    { value: 'cyan', label: 'Cyan', badgeClassName: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100 dark:border-cyan-800/60', swatchClassName: 'bg-cyan-500' },
] as const;

const roundValue = (value: number, digits: number = 4): number => Number(value.toFixed(digits));
const clampScore = (value: number): number => Math.max(0, Math.min(100, value));

const calculateMean = (values: number[]): number | null => {
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const calculateSampleStandardDeviation = (values: number[]): number | null => {
    if (values.length < 2) return null;
    const mean = calculateMean(values);
    if (mean === null) return null;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
};

export const calculateGradebookGpa = (percentage: number | null, scalingTable: GradebookScalingTable): number | null => {
    if (percentage === null || !Number.isFinite(percentage)) return null;

    for (const [range, rawGpa] of Object.entries(scalingTable)) {
        const key = String(range).trim();
        const gpa = Number(rawGpa);
        if (!Number.isFinite(gpa)) continue;

        if (key.includes('-')) {
            const [left, right] = key.split('-', 2).map((part) => Number(part.trim()));
            if (Number.isFinite(left) && Number.isFinite(right)) {
                const min = Math.min(left, right);
                const max = Math.max(left, right);
                if (percentage >= min && percentage <= max) {
                    return roundValue(gpa, 3);
                }
            }
            continue;
        }

        if (key.startsWith('>=') || key.startsWith('>')) {
            const threshold = Number(key.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(threshold) && percentage >= threshold) {
                return roundValue(gpa, 3);
            }
            continue;
        }

        const numeric = Number(key);
        if (Number.isFinite(numeric) && percentage >= numeric) {
            return roundValue(gpa, 3);
        }
    }

    return 0;
};

export const resolveTargetPercentageForGpa = (
    targetGpa: number,
    scalingTable: GradebookScalingTable,
): number | null => {
    let threshold: number | null = null;
    for (let percentage = 0; percentage <= 100; percentage += 1) {
        const gpa = calculateGradebookGpa(percentage, scalingTable);
        if (gpa !== null && gpa >= targetGpa) {
            threshold = percentage;
            break;
        }
    }
    return threshold;
};

const getPendingAssessments = (gradebook: CourseGradebook): GradebookAssessment[] => (
    gradebook.assessments.filter((assessment) => assessment.score === null)
);

const getGradedAssessments = (gradebook: CourseGradebook): GradebookAssessment[] => (
    gradebook.assessments.filter((assessment) => assessment.score !== null)
);

export const buildCategoryStats = (gradebook: CourseGradebook): GradebookCategoryStats[] => {
    const categories = new Map(gradebook.categories.map((category) => [category.id, category]));
    const graded = getGradedAssessments(gradebook);
    const globalScores = graded.map((assessment) => assessment.score ?? 0);
    const fallbackDeviation = Math.max(calculateSampleStandardDeviation(globalScores) ?? 0, 12);
    const pendingCategoryIds = new Set(getPendingAssessments(gradebook).map((assessment) => assessment.category_id));

    return Array.from(pendingCategoryIds).map((categoryId) => {
        const category = categoryId ? categories.get(categoryId) : undefined;
        const values = graded
            .filter((assessment) => assessment.category_id === categoryId)
            .map((assessment) => assessment.score ?? 0);
        const mean = calculateMean(values);
        const deviation = values.length >= 2 ? calculateSampleStandardDeviation(values) : values.length === 1 ? fallbackDeviation : null;

        return {
            categoryId,
            categoryName: category?.name ?? 'Uncategorized',
            sampleCount: values.length,
            meanScore: mean === null ? null : roundValue(mean, 3),
            standardDeviation: deviation === null ? null : roundValue(Math.max(deviation, 8), 3),
            hasHistory: values.length > 0,
        };
    });
};

const calculateCurrentScorePercentage = (gradebook: CourseGradebook): number => roundValue(
    getGradedAssessments(gradebook).reduce((sum, assessment) => (
        sum + (assessment.weight * (assessment.score ?? 0)) / 100
    ), 0),
);

export const calculateRequiredAverage = (
    gradebook: CourseGradebook,
    targetGpa: number,
): number | null => {
    const targetPercentage = resolveTargetPercentageForGpa(targetGpa, gradebook.scaling_table);
    const pendingAssessments = getPendingAssessments(gradebook);
    const remainingWeight = pendingAssessments.reduce((sum, assessment) => sum + assessment.weight, 0);
    if (targetPercentage === null) return null;
    if (remainingWeight <= 0) return calculateCurrentScorePercentage(gradebook) >= targetPercentage ? 0 : null;

    const currentContribution = calculateCurrentScorePercentage(gradebook);
    const requiredAverage = ((targetPercentage - currentContribution) / remainingWeight) * 100;
    return roundValue(requiredAverage, 3);
};

export const buildComputedGradebookSummary = (gradebook: CourseGradebook): ComputedGradebookSummary => {
    const currentRealPercentage = calculateCurrentScorePercentage(gradebook);
    const currentRealGpa = calculateGradebookGpa(currentRealPercentage, gradebook.scaling_table) ?? 0;
    const categoryStats = buildCategoryStats(gradebook);
    const categoryMap = new Map(categoryStats.map((stats) => [stats.categoryId, stats]));
    const pendingAssessments = getPendingAssessments(gradebook);
    const missingHistoryCategories = Array.from(
        new Set(
            pendingAssessments
                .filter((assessment) => !(categoryMap.get(assessment.category_id)?.hasHistory))
                .map((assessment) => categoryMap.get(assessment.category_id)?.categoryName ?? 'Uncategorized'),
        ),
    );

    let forecastPercentage: number | null = null;
    if (gradebook.forecast_model === 'auto' && pendingAssessments.length > 0 && missingHistoryCategories.length === 0) {
        const projectedContribution = pendingAssessments.reduce((sum, assessment) => {
            const stats = categoryMap.get(assessment.category_id);
            return sum + (assessment.weight * (stats?.meanScore ?? 0)) / 100;
        }, currentRealPercentage);
        forecastPercentage = roundValue(projectedContribution, 3);
    }

    const categoriesById = new Map(gradebook.categories.map((category) => [category.id, category]));
    return {
        current_real_percentage: currentRealPercentage,
        current_real_gpa: currentRealGpa,
        forecast_percentage: forecastPercentage,
        forecast_gpa: forecastPercentage === null ? null : calculateGradebookGpa(forecastPercentage, gradebook.scaling_table),
        minimum_required_average: calculateRequiredAverage(gradebook, gradebook.target_gpa),
        target_gpa: gradebook.target_gpa,
        target_percentage: resolveTargetPercentageForGpa(gradebook.target_gpa, gradebook.scaling_table),
        remaining_weight: roundValue(pendingAssessments.reduce((sum, assessment) => sum + assessment.weight, 0), 3),
        graded_count: getGradedAssessments(gradebook).length,
        ungraded_count: pendingAssessments.length,
        forecast_model: gradebook.forecast_model,
        missing_history_categories: missingHistoryCategories,
        category_stats: categoryStats,
        upcoming_due_items: pendingAssessments
            .filter((assessment) => Boolean(assessment.due_date))
            .slice()
            .sort((left, right) => {
                const dueComparison = (left.due_date ?? '').localeCompare(right.due_date ?? '');
                if (dueComparison !== 0) return dueComparison;
                return left.order_index - right.order_index;
            })
            .map((assessment) => {
                const category = assessment.category_id ? categoriesById.get(assessment.category_id) : undefined;
                return {
                    assessment_id: assessment.id,
                    title: assessment.title,
                    due_date: assessment.due_date ?? '',
                    category_name: category?.name ?? null,
                    category_color_token: category?.color_token ?? null,
                };
            }),
    };
};

const distributeUniformScores = (
    pendingAssessments: GradebookAssessment[],
    recommendations: Record<string, number>,
    deficitContribution: number,
): number => {
    const uniformAssessments = pendingAssessments.filter((assessment) => recommendations[assessment.id] === 50);
    const totalWeight = uniformAssessments.reduce((sum, assessment) => sum + assessment.weight, 0);
    if (totalWeight <= 0 || deficitContribution <= 0) return deficitContribution;

    const nextScore = clampScore(50 + (deficitContribution * 100) / totalWeight);
    uniformAssessments.forEach((assessment) => {
        recommendations[assessment.id] = nextScore;
    });
    const addedContribution = uniformAssessments.reduce((sum, assessment) => (
        sum + (assessment.weight * (nextScore - 50)) / 100
    ), 0);
    return Math.max(0, deficitContribution - addedContribution);
};

const distributeHistoryScores = (
    weightedHistory: Array<{ assessment: GradebookAssessment; mean: number; deviation: number }>,
    recommendations: Record<string, number>,
    deficitContribution: number,
): number => {
    if (weightedHistory.length === 0 || deficitContribution <= 0) return deficitContribution;

    const active = [...weightedHistory];
    let remainingDeficit = deficitContribution;

    while (active.length > 0 && remainingDeficit > 0.0001) {
        const denominator = active.reduce((sum, item) => sum + ((item.assessment.weight ** 2) * (item.deviation ** 2)), 0);
        if (denominator <= 0) break;

        const saturating = active.filter((item) => {
            const baseScore = recommendations[item.assessment.id];
            const delta = remainingDeficit * 100 * item.assessment.weight * (item.deviation ** 2) / denominator;
            return baseScore + delta >= 100;
        });

        if (saturating.length > 0) {
            saturating.forEach((item) => {
                const currentScore = recommendations[item.assessment.id];
                recommendations[item.assessment.id] = 100;
                remainingDeficit -= (item.assessment.weight * (100 - currentScore)) / 100;
                active.splice(active.findIndex((entry) => entry.assessment.id === item.assessment.id), 1);
            });
            continue;
        }

        active.forEach((item) => {
            const delta = remainingDeficit * 100 * item.assessment.weight * (item.deviation ** 2) / denominator;
            recommendations[item.assessment.id] = clampScore(recommendations[item.assessment.id] + delta);
        });
        remainingDeficit = 0;
    }

    return Math.max(0, remainingDeficit);
};

export const buildSuggestedWhatIfScores = (
    gradebook: CourseGradebook,
    targetGpa: number,
): Record<string, number> => {
    const pendingAssessments = getPendingAssessments(gradebook);
    const recommendations: Record<string, number> = {};
    if (pendingAssessments.length === 0) return recommendations;

    const targetPercentage = resolveTargetPercentageForGpa(targetGpa, gradebook.scaling_table);
    if (targetPercentage === null) return recommendations;

    const currentContribution = calculateCurrentScorePercentage(gradebook);
    const requiredAverage = calculateRequiredAverage(gradebook, targetGpa);
    if (gradebook.forecast_model === 'simple_minimum_needed') {
        const suggested = clampScore(requiredAverage ?? 0);
        pendingAssessments.forEach((assessment) => {
            recommendations[assessment.id] = suggested;
        });
        return recommendations;
    }

    const categoryStats = new Map(buildCategoryStats(gradebook).map((stats) => [stats.categoryId, stats]));
    const historyAssessments: Array<{ assessment: GradebookAssessment; mean: number; deviation: number }> = [];

    pendingAssessments.forEach((assessment) => {
        const stats = categoryStats.get(assessment.category_id);
        if (stats?.hasHistory && stats.meanScore !== null && stats.standardDeviation !== null) {
            const mean = clampScore(stats.meanScore);
            recommendations[assessment.id] = mean;
            historyAssessments.push({
                assessment,
                mean,
                deviation: Math.max(stats.standardDeviation, 8),
            });
            return;
        }
        recommendations[assessment.id] = 50;
    });

    const baseProjection = pendingAssessments.reduce((sum, assessment) => (
        sum + (assessment.weight * (recommendations[assessment.id] ?? 0)) / 100
    ), currentContribution);

    let remainingDeficit = Math.max(0, targetPercentage - baseProjection);
    remainingDeficit = distributeUniformScores(pendingAssessments, recommendations, remainingDeficit);
    distributeHistoryScores(historyAssessments, recommendations, remainingDeficit);
    return recommendations;
};

export const buildPlanModeResult = (
    gradebook: CourseGradebook,
    targetGpa: number,
    whatIfScores: Record<string, number>,
): ComputedPlanModeResult => {
    const pendingAssessments = getPendingAssessments(gradebook);
    const currentContribution = calculateCurrentScorePercentage(gradebook);
    const targetPercentage = resolveTargetPercentageForGpa(targetGpa, gradebook.scaling_table);
    const projectedPercentage = roundValue(
        pendingAssessments.reduce((sum, assessment) => (
            sum + (assessment.weight * clampScore(whatIfScores[assessment.id] ?? 0)) / 100
        ), currentContribution),
        3,
    );

    const shortfall = targetPercentage === null ? 0 : roundValue(Math.max(0, targetPercentage - projectedPercentage), 3);
    return {
        recommended_scores: whatIfScores,
        projected_percentage: projectedPercentage,
        projected_gpa: calculateGradebookGpa(projectedPercentage, gradebook.scaling_table) ?? 0,
        target_gpa: targetGpa,
        target_percentage: targetPercentage,
        required_average: calculateRequiredAverage(gradebook, targetGpa),
        remaining_weight: roundValue(pendingAssessments.reduce((sum, assessment) => sum + assessment.weight, 0), 3),
        is_feasible: targetPercentage !== null && shortfall <= 0.01,
        shortfall_percentage: shortfall,
    };
};

export const normalizeGradebookViewSettings = (value: unknown): GradebookViewSettings => {
    const settings = typeof value === 'object' && value !== null ? value as Partial<GradebookViewSettings> : {};
    return {
        sortKey: settings.sortKey ?? DEFAULT_GRADEBOOK_VIEW_SETTINGS.sortKey,
        sortDirection: settings.sortDirection ?? DEFAULT_GRADEBOOK_VIEW_SETTINGS.sortDirection,
        filter: settings.filter ?? DEFAULT_GRADEBOOK_VIEW_SETTINGS.filter,
    };
};

export const formatGradebookDate = (value: string | null | undefined): string => {
    if (!value) return 'No due date';
    const parsed = parseISO(value);
    if (!isValid(parsed)) return 'No due date';
    return format(parsed, 'MMM d, yyyy');
};

export const formatGradebookDateInput = (value: string | null | undefined): string => {
    if (!value) return '';
    return value.slice(0, 10);
};

export const getCategoryBadgeClassName = (colorToken: string | null | undefined): string => {
    return CATEGORY_COLOR_OPTIONS.find((option) => option.value === colorToken)?.badgeClassName
        ?? CATEGORY_COLOR_OPTIONS[CATEGORY_COLOR_OPTIONS.length - 1].badgeClassName;
};

export const isHexCategoryColor = (colorToken: string | null | undefined): boolean => (
    Boolean(colorToken && /^#[0-9a-fA-F]{6}$/.test(colorToken))
);

export const getCategoryBadgeStyle = (colorToken: string | null | undefined): React.CSSProperties | undefined => {
    if (!isHexCategoryColor(colorToken)) return undefined;
    const resolvedColor = colorToken as string;
    return {
        backgroundColor: `${resolvedColor}22`,
        color: resolvedColor,
    };
};

export const getCategorySwatchClassName = (colorToken: string | null | undefined): string => {
    return CATEGORY_COLOR_OPTIONS.find((option) => option.value === colorToken)?.swatchClassName
        ?? CATEGORY_COLOR_OPTIONS[CATEGORY_COLOR_OPTIONS.length - 1].swatchClassName;
};

export const getCategoryById = (
    categories: GradebookAssessmentCategory[],
    categoryId: string | null | undefined,
): GradebookAssessmentCategory | undefined => categories.find((category) => category.id === categoryId);

export const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    return `${value.toFixed(2)}%`;
};

export const formatGpa = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    return value.toFixed(2);
};

export const getApiErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error !== null) {
        const maybeResponse = (error as { response?: { data?: { detail?: string } } }).response;
        if (maybeResponse?.data?.detail) {
            return maybeResponse.data.detail;
        }
    }
    return 'Something went wrong while updating the gradebook.';
};

export const getRelativeDueText = (value: string | null | undefined): string => {
    if (!value) return 'No due date';
    const parsed = parseISO(value);
    if (!isValid(parsed)) return 'No due date';
    return formatDistanceToNowStrict(parsed, { addSuffix: true });
};

export const isAssessmentOverdue = (assessment: GradebookAssessment): boolean => {
    if (!assessment.due_date || assessment.score !== null) {
        return false;
    }
    const parsed = parseISO(assessment.due_date);
    if (!isValid(parsed)) return false;
    return parsed < startOfDay(new Date());
};

export const sortAssessments = (
    assessments: GradebookAssessment[],
    categoriesById: Map<string, GradebookAssessmentCategory>,
    sortKey: GradebookSortKey,
    sortDirection: GradebookSortDirection,
): GradebookAssessment[] => {
    if (sortDirection === 'none') {
        return assessments.slice().sort((left, right) => left.order_index - right.order_index);
    }
    const direction = sortDirection === 'asc' ? 1 : -1;
    return assessments.slice().sort((left, right) => {
        switch (sortKey) {
            case 'category': {
                const leftName = categoriesById.get(left.category_id ?? '')?.name ?? '';
                const rightName = categoriesById.get(right.category_id ?? '')?.name ?? '';
                return leftName.localeCompare(rightName) * direction;
            }
            case 'weight':
                return (left.weight - right.weight) * direction;
            case 'score':
                return (((left.score ?? -1) - (right.score ?? -1))) * direction;
            case 'due_date': {
                const leftValue = left.due_date ?? '9999-12-31';
                const rightValue = right.due_date ?? '9999-12-31';
                return leftValue.localeCompare(rightValue) * direction;
            }
            case 'title':
            default:
                return left.title.localeCompare(right.title) * direction;
        }
    });
};
