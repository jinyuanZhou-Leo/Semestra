// input:  [gradebook API contracts, date-fns helpers, builtin-gradebook table view preferences, and shared badge-color utilities]
// output: [builtin-gradebook plugin constants, exact-weight-gated forecast/plan calculators, shared formatters, stable GPA-threshold resolution helpers, exact-percentage planning helpers, and category badge color helpers]
// pos:    [shared gradebook domain layer used by the rebuilt builtin-gradebook tab, widget, settings surface, and Canvas handoff target resolution, including exact-100 total-weight calculation gating, band-aware numeric-or-range GPA scale parsing, continuous matching for adjacent integer-authored ranges, and exact percentage plan targets]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import { format, formatDistanceToNowStrict, isValid, parseISO, startOfDay } from 'date-fns';
import type React from 'react';
import type {
    Course,
    CourseGradebook,
    GradebookAssessment,
    GradebookAssessmentCategory,
    GradebookForecastModel,
    GradebookScalingTable,
} from '@/services/api';
import { getHexBadgeStyle } from '@/utils/courseCategoryBadge';

export const BUILTIN_GRADEBOOK_PLUGIN_ID = 'builtin-gradebook';
export const BUILTIN_GRADEBOOK_TAB_TYPE = 'builtin-gradebook';
export const BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE = 'builtin-gradebook-summary';

export interface GradebookDefaultCategoryTemplate {
    name: string;
    color_token: string;
}

export interface GradebookDefaultsSettings {
    forecast_model: GradebookForecastModel;
    categories: GradebookDefaultCategoryTemplate[];
}

export const formatGradebookGpaPercentage = (value: number): string => {
    if (!Number.isFinite(value)) {
        return '0.0%';
    }
    return `${value.toFixed(1)}%`;
};

export type GradebookSortKey = 'due_date' | 'category' | 'weight' | 'score' | 'title';
export type GradebookSortDirection = 'asc' | 'desc' | 'none';
export type GradebookFilterKey = 'all' | 'graded' | 'ungraded';

export interface GradebookViewSettings {
    sortKey: GradebookSortKey;
    sortDirection: GradebookSortDirection;
    filter: GradebookFilterKey;
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
    current_real_percentage: number | null;
    current_real_gpa: number | null;
    forecast_percentage: number | null;
    forecast_gpa: number | null;
    minimum_required_average: number | null;
    target_gpa: number;
    target_percentage: number | null;
    total_weight: number;
    remaining_weight: number;
    graded_count: number;
    ungraded_count: number;
    has_complete_weight: boolean;
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

export interface ComputedSemesterGradebookSummary {
    current_percentage: number | null;
    current_gpa: number | null;
    included_credits: number;
    included_course_count: number;
    excluded_course_count: number;
}

export interface ComputedSemesterGradebookPlanResult {
    projected_percentage: number | null;
    projected_gpa: number | null;
    target_percentage: number | null;
    included_credits: number;
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
const DEFAULT_CATEGORY_COLOR_OPTION = CATEGORY_COLOR_OPTIONS.find((option) => option.value === 'slate') ?? CATEGORY_COLOR_OPTIONS[0];

export const DEFAULT_GRADEBOOK_CATEGORY_TEMPLATES: GradebookDefaultCategoryTemplate[] = [
    { name: 'Quiz', color_token: 'blue' },
    { name: 'Exam', color_token: 'amber' },
    { name: 'Assignment', color_token: 'emerald' },
    { name: 'Project', color_token: 'violet' },
    { name: 'Lab', color_token: 'cyan' },
    { name: 'Presentation', color_token: 'rose' },
    { name: 'Participation', color_token: 'slate' },
];

export const DEFAULT_GRADEBOOK_DEFAULTS_SETTINGS: GradebookDefaultsSettings = {
    forecast_model: 'auto',
    categories: DEFAULT_GRADEBOOK_CATEGORY_TEMPLATES,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const normalizeGradebookDefaultsSettings = (settings: unknown): GradebookDefaultsSettings => {
    const root = isRecord(settings) ? settings : {};
    const categories = Array.isArray(root.categories)
        ? root.categories
            .map((entry) => {
                if (!isRecord(entry) || typeof entry.name !== 'string') {
                    return null;
                }
                const normalizedColor = typeof entry.color_token === 'string' && entry.color_token.trim()
                    ? entry.color_token.trim()
                    : DEFAULT_CATEGORY_COLOR_OPTION.value;
                return {
                    name: entry.name.trim(),
                    color_token: normalizedColor,
                } satisfies GradebookDefaultCategoryTemplate;
            })
            .filter((entry): entry is GradebookDefaultCategoryTemplate => Boolean(entry && entry.name))
        : [];

    return {
        forecast_model: root.forecast_model === 'simple_minimum_needed' ? 'simple_minimum_needed' : 'auto',
        categories: categories.length > 0 ? categories : DEFAULT_GRADEBOOK_DEFAULTS_SETTINGS.categories,
    };
};

const roundValue = (value: number, digits: number = 4): number => Number(value.toFixed(digits));
const clampScore = (value: number): number => Math.max(0, Math.min(100, value));
const ceilScore = (value: number): number => clampScore(Math.ceil(value));
const floorScore = (value: number): number => clampScore(Math.floor(value));
const GRADEBOOK_WEIGHT_TOLERANCE = 0.001;
const SCORE_DOMAIN_END = 100;
const RANGE_TOLERANCE = 1e-9;

const matchesRange = (percentage: number, left: number, right: number): boolean => {
    const min = Math.min(left, right);
    const max = Math.max(left, right);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;

    const upperBound = Number.isInteger(min) && Number.isInteger(max)
        ? (max >= SCORE_DOMAIN_END ? SCORE_DOMAIN_END + RANGE_TOLERANCE : max + 1)
        : max + RANGE_TOLERANCE;

    return percentage >= min && percentage < upperBound;
};

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

    const numericThresholdEntries: Array<{ threshold: number; gpa: number }> = [];
    for (const [range, rawGpa] of Object.entries(scalingTable)) {
        const key = String(range).trim();
        const gpa = Number(rawGpa);
        if (!Number.isFinite(gpa)) continue;

        if (key.includes('-')) {
            const [left, right] = key.split('-', 2).map((part) => Number(part.trim()));
            if (Number.isFinite(left) && Number.isFinite(right) && matchesRange(percentage, left, right)) {
                return roundValue(gpa, 3);
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
        if (Number.isFinite(numeric)) {
            numericThresholdEntries.push({ threshold: numeric, gpa });
        }
    }

    numericThresholdEntries.sort((left, right) => left.threshold - right.threshold);
    for (let index = 0; index < numericThresholdEntries.length; index += 1) {
        const current = numericThresholdEntries[index];
        const next = numericThresholdEntries[index + 1];
        if (!current) continue;
        const withinLowerBound = percentage >= current.threshold;
        const withinUpperBound = !next || percentage < next.threshold;
        if (withinLowerBound && withinUpperBound) {
            return roundValue(current.gpa, 3);
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

export const calculateTotalWeight = (gradebook: CourseGradebook): number => roundValue(
    gradebook.assessments.reduce((sum, assessment) => sum + assessment.weight, 0),
    3,
);

export const hasCompleteGradebookWeight = (gradebook: CourseGradebook): boolean => (
    Math.abs(calculateTotalWeight(gradebook) - 100) <= GRADEBOOK_WEIGHT_TOLERANCE
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
    targetPercentage: number | null,
): number | null => {
    const pendingAssessments = getPendingAssessments(gradebook);
    const remainingWeight = pendingAssessments.reduce((sum, assessment) => sum + assessment.weight, 0);
    if (targetPercentage === null) return null;
    if (remainingWeight <= 0) return calculateCurrentScorePercentage(gradebook) >= targetPercentage ? 0 : null;

    const currentContribution = calculateCurrentScorePercentage(gradebook);
    const requiredAverage = ((targetPercentage - currentContribution) / remainingWeight) * 100;
    return roundValue(requiredAverage, 3);
};

export const buildComputedGradebookSummary = (gradebook: CourseGradebook): ComputedGradebookSummary => {
    const totalWeight = calculateTotalWeight(gradebook);
    const hasCompleteWeight = hasCompleteGradebookWeight(gradebook);
    const currentRealPercentage = hasCompleteWeight ? calculateCurrentScorePercentage(gradebook) : null;
    const currentRealGpa = currentRealPercentage === null
        ? null
        : calculateGradebookGpa(currentRealPercentage, gradebook.scaling_table);
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
    if (hasCompleteWeight && gradebook.forecast_model === 'auto' && pendingAssessments.length > 0 && missingHistoryCategories.length === 0) {
        const projectedContribution = pendingAssessments.reduce((sum, assessment) => {
            const stats = categoryMap.get(assessment.category_id);
            return sum + (assessment.weight * (stats?.meanScore ?? 0)) / 100;
        }, currentRealPercentage ?? 0);
        forecastPercentage = roundValue(projectedContribution, 3);
    }

    const categoriesById = new Map(gradebook.categories.map((category) => [category.id, category]));
    return {
        current_real_percentage: currentRealPercentage,
        current_real_gpa: currentRealGpa,
        forecast_percentage: forecastPercentage,
        forecast_gpa: forecastPercentage === null ? null : calculateGradebookGpa(forecastPercentage, gradebook.scaling_table),
        minimum_required_average: hasCompleteWeight
            ? calculateRequiredAverage(gradebook, resolveTargetPercentageForGpa(gradebook.target_gpa, gradebook.scaling_table))
            : null,
        target_gpa: gradebook.target_gpa,
        target_percentage: resolveTargetPercentageForGpa(gradebook.target_gpa, gradebook.scaling_table),
        total_weight: totalWeight,
        remaining_weight: roundValue(pendingAssessments.reduce((sum, assessment) => sum + assessment.weight, 0), 3),
        graded_count: getGradedAssessments(gradebook).length,
        ungraded_count: pendingAssessments.length,
        has_complete_weight: hasCompleteWeight,
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

const getIncludedSemesterCourses = (courses: Course[]) => (
    courses.filter((course) => course.include_in_gpa !== false && Number(course.credits) > 0)
);

const courseHasGrade = (course: Course) => Number(course.grade_percentage || 0) > 0;

export const buildSemesterGradebookSummary = (courses: Course[]): ComputedSemesterGradebookSummary => {
    const includedCourses = getIncludedSemesterCourses(courses);
    const includedCredits = roundValue(includedCourses.reduce((sum, course) => sum + Number(course.credits || 0), 0), 3);
    const gradedCourses = includedCourses.filter(courseHasGrade);
    const gradedCredits = roundValue(gradedCourses.reduce((sum, course) => sum + Number(course.credits || 0), 0), 3);

    return {
        current_percentage: gradedCredits <= 0 ? null : roundValue(
            gradedCourses.reduce((sum, course) => sum + Number(course.grade_percentage) * Number(course.credits), 0) / gradedCredits,
            3,
        ),
        current_gpa: gradedCredits <= 0 ? null : roundValue(
            gradedCourses.reduce((sum, course) => sum + Number(course.grade_scaled || 0) * Number(course.credits), 0) / gradedCredits,
            3,
        ),
        included_credits: includedCredits,
        included_course_count: includedCourses.length,
        excluded_course_count: courses.length - includedCourses.length,
    };
};

export const buildSemesterGradebookPlanResult = (
    courses: Course[],
    whatIfScores: Record<string, number>,
    scalingTable: GradebookScalingTable,
    targetPercentage: number | null,
): ComputedSemesterGradebookPlanResult => {
    const includedCourses = getIncludedSemesterCourses(courses);
    const includedCredits = roundValue(includedCourses.reduce((sum, course) => sum + Number(course.credits || 0), 0), 3);
    if (includedCredits <= 0) {
        return {
            projected_percentage: null,
            projected_gpa: null,
            target_percentage: targetPercentage,
            included_credits: 0,
            is_feasible: false,
            shortfall_percentage: targetPercentage ?? 0,
        };
    }

    const projectedPercentage = roundValue(
        includedCourses.reduce((sum, course) => {
            const hasGrade = courseHasGrade(course);
            const rawScore = !hasGrade ? whatIfScores[course.id] : undefined;
            const score = rawScore !== undefined && Number.isFinite(rawScore)
                ? clampScore(rawScore)
                : Number(course.grade_percentage || 0);
            return sum + score * Number(course.credits || 0);
        }, 0) / includedCredits,
        3,
    );
    const projectedGpa = roundValue(
        includedCourses.reduce((sum, course) => {
            const hasGrade = courseHasGrade(course);
            const rawScore = !hasGrade ? whatIfScores[course.id] : undefined;
            const hasWhatIf = rawScore !== undefined && Number.isFinite(rawScore);
            const score = hasWhatIf ? clampScore(rawScore!) : Number(course.grade_percentage || 0);
            const gpa = hasWhatIf
                ? calculateGradebookGpa(score, scalingTable) ?? Number(course.grade_scaled || 0)
                : Number(course.grade_scaled || 0);
            return sum + gpa * Number(course.credits || 0);
        }, 0) / includedCredits,
        3,
    );
    const shortfall = targetPercentage === null ? 0 : roundValue(Math.max(0, targetPercentage - projectedPercentage), 3);

    return {
        projected_percentage: projectedPercentage,
        projected_gpa: projectedGpa,
        target_percentage: targetPercentage,
        included_credits: includedCredits,
        is_feasible: targetPercentage !== null && shortfall <= 0.01,
        shortfall_percentage: shortfall,
    };
};

// Controls how strongly per-category mean is shrunk toward the global mean.
// With K=3: n=1 → 25% category weight; n=3 → 50%; n=9 → 75%.
const SHRINKAGE_K = 3;

const calculateGlobalWeightedMean = (gradebook: CourseGradebook): number | null => {
    const graded = getGradedAssessments(gradebook);
    const totalWeight = graded.reduce((sum, assessment) => sum + assessment.weight, 0);
    if (totalWeight <= 0) return null;
    return roundValue(
        graded.reduce((sum, assessment) => sum + assessment.weight * (assessment.score ?? 0), 0) / totalWeight,
        3,
    );
};

export const buildSuggestedWhatIfScores = (
    gradebook: CourseGradebook,
    targetPercentage: number | null,
): Record<string, number> => {
    const pendingAssessments = getPendingAssessments(gradebook);
    const recommendations: Record<string, number> = {};
    if (pendingAssessments.length === 0) return recommendations;

    if (targetPercentage === null) return recommendations;

    const currentContribution = calculateCurrentScorePercentage(gradebook);
    const requiredAverage = calculateRequiredAverage(gradebook, targetPercentage);

    if (gradebook.forecast_model === 'simple_minimum_needed') {
        // Assign the same minimum required score to every pending assessment, capped at 100.
        const suggested = ceilScore(Math.max(0, requiredAverage ?? 0));
        pendingAssessments.forEach((assessment) => {
            recommendations[assessment.id] = suggested;
        });
        return recommendations;
    }

    // Auto mode: Equal Extra Effort algorithm.
    //
    // 1. Estimate an expected score for each pending assessment using shrinkage:
    //    pull the per-category mean toward the student's global weighted mean,
    //    so that thin category history (n=1,2) does not dominate.
    // 2. Shift the expected scores toward the target percentage by applying
    //    a uniform adjustment across pending assessments.
    // 3. Handle saturation iteratively in either direction (score → 100 or 0).

    const globalMean = calculateGlobalWeightedMean(gradebook);
    const categoryStats = new Map(buildCategoryStats(gradebook).map((stats) => [stats.categoryId, stats]));

    pendingAssessments.forEach((assessment) => {
        const stats = categoryStats.get(assessment.category_id);
        const categoryMean = stats?.meanScore ?? null;
        const sampleCount = stats?.sampleCount ?? 0;

        if (globalMean !== null && categoryMean !== null && sampleCount > 0) {
            const alpha = sampleCount / (sampleCount + SHRINKAGE_K);
            recommendations[assessment.id] = clampScore(alpha * categoryMean + (1 - alpha) * globalMean);
        } else {
            // No graded assessments at all, or this category has no history:
            // fall back to global mean, or to requiredAverage if even that is unavailable.
            recommendations[assessment.id] = clampScore(globalMean ?? Math.max(0, requiredAverage ?? 0));
        }
    });

    const baseProjection = pendingAssessments.reduce((sum, assessment) => (
        sum + (assessment.weight * recommendations[assessment.id]) / 100
    ), currentContribution);

    if (baseProjection < targetPercentage - 0.0001) {
        let remaining = targetPercentage - baseProjection;
        let active = pendingAssessments.filter((assessment) => recommendations[assessment.id] < 100);

        while (active.length > 0 && remaining > 0.0001) {
            const activeWeight = active.reduce((sum, assessment) => sum + assessment.weight, 0);
            if (activeWeight <= 0) break;

            const delta = (remaining * 100) / activeWeight;
            const saturating = active.filter((assessment) => recommendations[assessment.id] + delta >= 100);

            if (saturating.length > 0) {
                saturating.forEach((assessment) => {
                    remaining = Math.max(0, remaining - (assessment.weight * (100 - recommendations[assessment.id])) / 100);
                    recommendations[assessment.id] = 100;
                });
                active = active.filter((assessment) => recommendations[assessment.id] < 100);
            } else {
                active.forEach((assessment) => {
                    recommendations[assessment.id] = clampScore(recommendations[assessment.id] + delta);
                });
                remaining = 0;
            }
        }
    } else if (baseProjection > targetPercentage + 0.0001) {
        let excess = baseProjection - targetPercentage;
        let active = pendingAssessments.filter((assessment) => recommendations[assessment.id] > 0);

        while (active.length > 0 && excess > 0.0001) {
            const activeWeight = active.reduce((sum, assessment) => sum + assessment.weight, 0);
            if (activeWeight <= 0) break;

            const delta = (excess * 100) / activeWeight;
            const saturating = active.filter((assessment) => recommendations[assessment.id] - delta <= 0);

            if (saturating.length > 0) {
                saturating.forEach((assessment) => {
                    excess = Math.max(0, excess - (assessment.weight * recommendations[assessment.id]) / 100);
                    recommendations[assessment.id] = 0;
                });
                active = active.filter((assessment) => recommendations[assessment.id] > 0);
            } else {
                active.forEach((assessment) => {
                    recommendations[assessment.id] = clampScore(recommendations[assessment.id] - delta);
                });
                excess = 0;
            }
        }
    }

    return Object.fromEntries(
        Object.entries(recommendations).map(([assessmentId, score]) => [
            assessmentId,
            baseProjection <= targetPercentage ? ceilScore(score) : floorScore(score),
        ]),
    );
};

export const buildPlanModeResult = (
    gradebook: CourseGradebook,
    targetGpa: number,
    targetPercentage: number | null,
    whatIfScores: Record<string, number>,
): ComputedPlanModeResult => {
    const pendingAssessments = getPendingAssessments(gradebook);
    const currentContribution = calculateCurrentScorePercentage(gradebook);
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
        required_average: calculateRequiredAverage(gradebook, targetPercentage),
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

export const parseDraftDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
};

export const getCategoryBadgeClassName = (colorToken: string | null | undefined): string => {
    return CATEGORY_COLOR_OPTIONS.find((option) => option.value === colorToken)?.badgeClassName
        ?? DEFAULT_CATEGORY_COLOR_OPTION.badgeClassName;
};

export const isHexCategoryColor = (colorToken: string | null | undefined): boolean => (
    Boolean(colorToken && /^#[0-9a-fA-F]{6}$/.test(colorToken))
);

export const getCategoryBadgeStyle = (colorToken: string | null | undefined): React.CSSProperties | undefined => {
    return getHexBadgeStyle(colorToken);
};

export const getCategorySwatchClassName = (colorToken: string | null | undefined): string => {
    return CATEGORY_COLOR_OPTIONS.find((option) => option.value === colorToken)?.swatchClassName
        ?? DEFAULT_CATEGORY_COLOR_OPTION.swatchClassName;
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
