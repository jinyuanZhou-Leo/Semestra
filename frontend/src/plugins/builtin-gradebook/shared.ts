// input:  [gradebook fact contracts, date-fns format helpers, and plugin-level UI state defaults]
// output: [builtin-gradebook constants, client-side projection calculators, and shared formatters]
// pos:    [shared calculation/configuration layer used by the builtin-gradebook tab, widget, and course-page integration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { format, formatDistanceToNowStrict, isBefore, isValid, parseISO, startOfDay } from 'date-fns';
import type {
    CourseGradebook,
    GradebookAssessment,
    GradebookAssessmentCategory,
    GradebookAssessmentStatus,
    GradebookFeasibility,
    GradebookScalingTable,
    GradebookTargetMode,
} from '@/services/api';

export const BUILTIN_GRADEBOOK_PLUGIN_ID = 'builtin-gradebook';
export const BUILTIN_GRADEBOOK_TAB_TYPE = 'builtin-gradebook';
export const BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE = 'builtin-gradebook-summary';
export const GRADEBOOK_OPEN_TAB_EVENT = 'semestra:open-course-gradebook-tab';
export const OPEN_GRADEBOOK_TAB_EVENT = GRADEBOOK_OPEN_TAB_EVENT;

export type GradebookSortKey = 'due_date' | 'type' | 'weight' | 'status' | 'title';
export type GradebookSortDirection = 'asc' | 'desc';
export type GradebookGroupBy = 'none' | 'type';
export type GradebookFilterKey = 'all' | 'upcoming' | 'missing_due' | 'completed' | 'excluded';
export type GradebookRailPanel = 'summary' | 'deadlines' | 'validation';

export interface GradebookViewSettings {
    selectedScenarioId: string | null;
    sortKey: GradebookSortKey;
    sortDirection: GradebookSortDirection;
    groupBy: GradebookGroupBy;
    filters: GradebookFilterKey;
    visibleColumns: string[];
    activeRailPanel: GradebookRailPanel;
}

export interface OpenGradebookTabDetail {
    courseId?: string;
    tabType: string;
}

export interface ComputedGradebookScenarioCard {
    scenario_id: string;
    scenario_name: string;
    projected_percentage: number | null;
    projected_gpa: number | null;
    required_score: number | null;
    remaining_weight: number;
    feasibility: GradebookFeasibility;
}

export interface ComputedGradebookUpcomingDueItem {
    assessment_id: string;
    title: string;
    due_date: string;
    category_name: string | null;
    category_color_token: string | null;
}

export interface ComputedGradebookSummary {
    current_actual_percentage: number;
    current_actual_gpa: number;
    baseline_target_mode: GradebookTargetMode;
    baseline_target_value: number;
    baseline_required_score: number | null;
    baseline_projected_percentage: number | null;
    baseline_projected_gpa: number | null;
    remaining_weight: number;
    feasibility: GradebookFeasibility;
    validation_issues: string[];
    scenario_cards: ComputedGradebookScenarioCard[];
    upcoming_due_items: ComputedGradebookUpcomingDueItem[];
}

export const DEFAULT_GRADEBOOK_VIEW_SETTINGS: GradebookViewSettings = {
    selectedScenarioId: null,
    sortKey: 'due_date',
    sortDirection: 'asc',
    groupBy: 'none',
    filters: 'all',
    visibleColumns: ['type', 'due', 'weight', 'status', 'mode', 'score', 'required'],
    activeRailPanel: 'summary',
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

export const GRADEBOOK_CATEGORY_COLOR_TOKENS = CATEGORY_COLOR_OPTIONS.map((option) => option.value);
const TARGET_MODE_VALUES: GradebookTargetMode[] = ['percentage', 'gpa'];

const roundValue = (value: number, digits: number = 4): number => Number(value.toFixed(digits));

const calculateGradebookGpa = (percentage: number | null, scalingTable: GradebookScalingTable): number | null => {
    if (percentage === null || !Number.isFinite(percentage)) return null;

    for (const [range, rawGpa] of Object.entries(scalingTable)) {
        const cleanRange = range.trim();
        const gpa = Number(rawGpa);
        if (!Number.isFinite(gpa)) continue;

        if (cleanRange.includes('-')) {
            const parts = cleanRange.split('-').map((part) => Number(part.trim()));
            if (parts.length === 2 && parts.every(Number.isFinite)) {
                const min = Math.min(parts[0], parts[1]);
                const max = Math.max(parts[0], parts[1]);
                if (percentage >= min && percentage <= max) {
                    return roundValue(gpa, 3);
                }
            }
            continue;
        }

        if (cleanRange.startsWith('>=')
            || cleanRange.startsWith('>')) {
            const threshold = Number(cleanRange.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(threshold) && percentage >= threshold) {
                return roundValue(gpa, 3);
            }
            continue;
        }

        const exactValue = Number(cleanRange);
        if (Number.isFinite(exactValue) && Math.abs(percentage - exactValue) < 0.01) {
            return roundValue(gpa, 3);
        }
    }

    const numericEntries = Object.entries(scalingTable)
        .filter(([key]) => !key.includes('-'))
        .map(([key, gpa]) => ({ key: Number(key), gpa: Number(gpa) }))
        .filter((entry) => Number.isFinite(entry.key) && Number.isFinite(entry.gpa))
        .sort((left, right) => right.key - left.key);

    for (const entry of numericEntries) {
        if (percentage >= entry.key) {
            return roundValue(entry.gpa, 3);
        }
    }

    return 0;
};

const resolveTargetPercentage = (
    targetMode: GradebookTargetMode,
    targetValue: number,
    scalingTable: GradebookScalingTable,
): number | null => {
    if (targetMode === 'percentage') {
        return targetValue;
    }

    let threshold: number | null = null;
    for (let percentage = 0; percentage <= 100; percentage += 1) {
        const resolvedGpa = calculateGradebookGpa(percentage, scalingTable);
        if (resolvedGpa !== null && resolvedGpa >= targetValue) {
            threshold = percentage;
            break;
        }
    }

    return threshold;
};

const buildValidationIssues = (gradebook: CourseGradebook): string[] => {
    const issues: string[] = [];
    const totalWeight = gradebook.assessments
        .filter((assessment) => assessment.status !== 'excluded')
        .reduce((sum, assessment) => sum + assessment.weight, 0);

    if (!TARGET_MODE_VALUES.includes(gradebook.target_mode)) {
        issues.push('Target mode must be percentage or gpa.');
    }
    if (gradebook.scenarios.length === 0) {
        issues.push('At least one scenario is required.');
    }
    if (getSelectedScenario(gradebook, gradebook.baseline_scenario_id)?.id == null) {
        issues.push('A baseline scenario is required.');
    }
    if (Math.abs(totalWeight - 100) > 0.01) {
        issues.push('Active assessment weights must sum to 100.00%.');
    }
    if (gradebook.target_mode === 'gpa' && resolveTargetPercentage(gradebook.target_mode, gradebook.target_value, gradebook.scaling_table) === null) {
        issues.push('Unable to resolve GPA target with the current scaling table.');
    }

    return issues;
};

const buildScenarioCard = (
    gradebook: CourseGradebook,
    scenarioId: string,
    scenarioName: string,
    targetPercentage: number,
    validationIssues: string[],
): ComputedGradebookScenarioCard => {
    let completedContribution = 0;
    let manualContribution = 0;
    let solverWeight = 0;

    for (const assessment of gradebook.assessments) {
        if (assessment.status === 'excluded') continue;

        if (assessment.status === 'completed') {
            if (assessment.actual_score !== null) {
                completedContribution += (assessment.weight * assessment.actual_score) / 100;
            }
            continue;
        }

        if (assessment.forecast_mode === 'solver') {
            solverWeight += assessment.weight;
            continue;
        }

        const forecastScore = getAssessmentScenarioScore(assessment, scenarioId);
        if (forecastScore !== null) {
            manualContribution += (assessment.weight * forecastScore) / 100;
        }
    }

    const remainingWeight = roundValue(
        gradebook.assessments
            .filter((assessment) => assessment.status !== 'excluded' && assessment.status !== 'completed')
            .reduce((sum, assessment) => sum + assessment.weight, 0),
    );
    const fixedContribution = completedContribution + manualContribution;

    if (validationIssues.length > 0) {
        return {
            scenario_id: scenarioId,
            scenario_name: scenarioName,
            projected_percentage: null,
            projected_gpa: null,
            required_score: null,
            remaining_weight: remainingWeight,
            feasibility: 'invalid',
        };
    }

    if (solverWeight > 0) {
        const requiredScore = ((targetPercentage - fixedContribution) / solverWeight) * 100;
        const clampedRequiredScore = Math.max(0, Math.min(requiredScore, 100));
        const projectedPercentage = fixedContribution + (solverWeight * clampedRequiredScore) / 100;
        const feasibility: GradebookFeasibility = requiredScore <= 0
            ? 'already_secured'
            : requiredScore > 100
                ? 'infeasible'
                : Math.abs(requiredScore - 100) <= 0.01
                    ? 'needs_perfection'
                    : 'on_track';

        return {
            scenario_id: scenarioId,
            scenario_name: scenarioName,
            projected_percentage: roundValue(projectedPercentage),
            projected_gpa: calculateGradebookGpa(projectedPercentage, gradebook.scaling_table),
            required_score: roundValue(requiredScore),
            remaining_weight: remainingWeight,
            feasibility,
        };
    }

    const projectedPercentage = fixedContribution;
    const alreadySecured = projectedPercentage >= targetPercentage;

    return {
        scenario_id: scenarioId,
        scenario_name: scenarioName,
        projected_percentage: roundValue(projectedPercentage),
        projected_gpa: calculateGradebookGpa(projectedPercentage, gradebook.scaling_table),
        required_score: alreadySecured ? 0 : null,
        remaining_weight: remainingWeight,
        feasibility: alreadySecured ? 'already_secured' : 'invalid',
    };
};

export const normalizeGradebookViewSettings = (value: unknown): GradebookViewSettings => {
    const settings = typeof value === 'object' && value !== null ? value as Partial<GradebookViewSettings> : {};
    return {
        selectedScenarioId: typeof settings.selectedScenarioId === 'string' ? settings.selectedScenarioId : null,
        sortKey: settings.sortKey ?? DEFAULT_GRADEBOOK_VIEW_SETTINGS.sortKey,
        sortDirection: settings.sortDirection ?? DEFAULT_GRADEBOOK_VIEW_SETTINGS.sortDirection,
        groupBy: settings.groupBy ?? DEFAULT_GRADEBOOK_VIEW_SETTINGS.groupBy,
        filters: settings.filters ?? DEFAULT_GRADEBOOK_VIEW_SETTINGS.filters,
        visibleColumns: Array.isArray(settings.visibleColumns) ? settings.visibleColumns : DEFAULT_GRADEBOOK_VIEW_SETTINGS.visibleColumns,
        activeRailPanel: settings.activeRailPanel ?? DEFAULT_GRADEBOOK_VIEW_SETTINGS.activeRailPanel,
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

export const getScenarioSwatchClassName = (colorToken: string | null | undefined): string => {
    return CATEGORY_COLOR_OPTIONS.find((option) => option.value === colorToken)?.swatchClassName
        ?? CATEGORY_COLOR_OPTIONS[CATEGORY_COLOR_OPTIONS.length - 1].swatchClassName;
};

export const getFeasibilityLabel = (value: GradebookFeasibility): string => {
    switch (value) {
        case 'already_secured':
            return 'Already Secured';
        case 'needs_perfection':
            return 'Needs Perfection';
        case 'infeasible':
            return 'Infeasible';
        case 'invalid':
            return 'Invalid Setup';
        case 'on_track':
        default:
            return 'On Track';
    }
};

export const getFeasibilityBadgeClassName = (value: GradebookFeasibility): string => {
    switch (value) {
        case 'already_secured':
            return 'border-teal-200/80 bg-teal-100 text-teal-700 dark:border-teal-900/70 dark:bg-teal-950/70 dark:text-teal-200';
        case 'needs_perfection':
            return 'border-amber-200/80 bg-amber-100 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/70 dark:text-amber-200';
        case 'infeasible':
            return 'border-rose-200/80 bg-rose-100 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/70 dark:text-rose-200';
        case 'invalid':
            return 'border-slate-200/80 bg-slate-100 text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-200';
        case 'on_track':
        default:
            return 'border-emerald-200/80 bg-emerald-100 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/70 dark:text-emerald-200';
    }
};

export const getAssessmentStatusLabel = (value: GradebookAssessmentStatus): string => {
    switch (value) {
        case 'completed':
            return 'Completed';
        case 'excluded':
            return 'Excluded';
        case 'planned':
        default:
            return 'Planned';
    }
};

export const getCategoryById = (
    categories: GradebookAssessmentCategory[],
    categoryId: string | null | undefined,
): GradebookAssessmentCategory | undefined => categories.find((category) => category.id === categoryId);

export const getAssessmentScenarioScore = (
    assessment: GradebookAssessment,
    scenarioId: string | null,
): number | null => {
    if (!scenarioId) return null;
    return assessment.scenario_scores.find((score) => score.scenario_id === scenarioId)?.forecast_score ?? null;
};

export const getSelectedScenarioId = (gradebook: CourseGradebook, settings: GradebookViewSettings): string | null => {
    if (settings.selectedScenarioId && gradebook.scenarios.some((scenario) => scenario.id === settings.selectedScenarioId)) {
        return settings.selectedScenarioId;
    }
    if (gradebook.baseline_scenario_id) return gradebook.baseline_scenario_id;
    return gradebook.scenarios[0]?.id ?? null;
};

export const getSelectedScenario = (gradebook: CourseGradebook | null, scenarioId: string | null) => {
    if (!gradebook) return null;
    return gradebook.scenarios.find((scenario) => scenario.id === scenarioId)
        ?? gradebook.scenarios.find((scenario) => scenario.id === gradebook.baseline_scenario_id)
        ?? gradebook.scenarios[0]
        ?? null;
};

export const buildComputedGradebookSummary = (gradebook: CourseGradebook): ComputedGradebookSummary => {
    const validationIssues = buildValidationIssues(gradebook);
    const targetPercentage = resolveTargetPercentage(
        gradebook.target_mode,
        gradebook.target_value,
        gradebook.scaling_table,
    ) ?? 0;

    const scenarioCards = gradebook.scenarios
        .slice()
        .sort((left, right) => left.order_index - right.order_index)
        .map((scenario) => buildScenarioCard(
            gradebook,
            scenario.id,
            scenario.name,
            targetPercentage,
            validationIssues,
        ));

    const baselineScenario = getSelectedScenario(gradebook, gradebook.baseline_scenario_id);
    const baselineCard = scenarioCards.find((card) => card.scenario_id === baselineScenario?.id) ?? scenarioCards[0] ?? null;

    const currentActualPercentage = roundValue(
        gradebook.assessments.reduce((sum, assessment) => {
            if (assessment.status !== 'completed' || assessment.actual_score === null) {
                return sum;
            }
            return sum + (assessment.weight * assessment.actual_score) / 100;
        }, 0),
    );

    const remainingWeight = roundValue(
        gradebook.assessments.reduce((sum, assessment) => (
            assessment.status === 'planned' ? sum + assessment.weight : sum
        ), 0),
    );

    const categoriesById = new Map(gradebook.categories.map((category) => [category.id, category]));
    const upcomingDueItems = gradebook.assessments
        .filter((assessment) => assessment.status === 'planned' && Boolean(assessment.due_date))
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
        });

    return {
        current_actual_percentage: currentActualPercentage,
        current_actual_gpa: calculateGradebookGpa(currentActualPercentage, gradebook.scaling_table) ?? 0,
        baseline_target_mode: gradebook.target_mode,
        baseline_target_value: gradebook.target_value,
        baseline_required_score: baselineCard?.required_score ?? null,
        baseline_projected_percentage: baselineCard?.projected_percentage ?? null,
        baseline_projected_gpa: baselineCard?.projected_gpa ?? null,
        remaining_weight: remainingWeight,
        feasibility: baselineCard?.feasibility ?? 'invalid',
        validation_issues: validationIssues,
        scenario_cards: scenarioCards,
        upcoming_due_items: upcomingDueItems,
    };
};

export const getScenarioRequiredScore = (
    computedSummary: ComputedGradebookSummary,
    scenarioId: string | null,
): number | null => {
    if (!scenarioId) return computedSummary.baseline_required_score;
    return computedSummary.scenario_cards.find((scenario) => scenario.scenario_id === scenarioId)?.required_score ?? null;
};

export const getAssessmentDisplayScore = (
    assessment: GradebookAssessment,
    scenarioId: string | null,
): number | null => {
    if (assessment.status === 'completed') {
        return assessment.actual_score;
    }
    return getAssessmentScenarioScore(assessment, scenarioId);
};

export const getAssessmentContribution = (
    assessment: GradebookAssessment,
    scenarioId: string | null,
): number | null => {
    const score = getAssessmentDisplayScore(assessment, scenarioId);
    if (score === null) return null;
    return (score * assessment.weight) / 100;
};

export const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    return `${value.toFixed(2)}%`;
};

export const formatGpa = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    return value.toFixed(2);
};

export const getRelativeDueText = (value: string | null | undefined): string => {
    if (!value) return 'No due date';
    const parsed = parseISO(value);
    if (!isValid(parsed)) return 'No due date';
    return formatDistanceToNowStrict(parsed, { addSuffix: true });
};

export const isAssessmentOverdue = (assessment: GradebookAssessment): boolean => {
    if (!assessment.due_date || assessment.status === 'completed' || assessment.status === 'excluded') {
        return false;
    }
    const parsed = parseISO(assessment.due_date);
    if (!isValid(parsed)) return false;
    return isBefore(parsed, startOfDay(new Date()));
};

export const dispatchOpenGradebookTab = (courseId?: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent<OpenGradebookTabDetail>(GRADEBOOK_OPEN_TAB_EVENT, {
            detail: {
                courseId,
                tabType: BUILTIN_GRADEBOOK_TAB_TYPE,
            },
        }),
    );
};

export const getApiErrorMessage = (error: unknown): string => {
    if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
    ) {
        return (error as { response: { data: { detail: string } } }).response.data.detail;
    }
    if (error instanceof Error) return error.message;
    return 'Something went wrong.';
};
