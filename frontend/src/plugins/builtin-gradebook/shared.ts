// input:  [gradebook API contracts, date-fns format helpers, and plugin-level UI state defaults]
// output: [builtin-gradebook constants, view-setting helpers, category color metadata, and shared formatters]
// pos:    [shared configuration layer used by the builtin-gradebook tab, widget, and course-page integration]
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

export const getScenarioRequiredScore = (gradebook: CourseGradebook, scenarioId: string | null): number | null => {
    if (!scenarioId) return gradebook.summary.baseline_required_score;
    return gradebook.summary.scenario_cards.find((scenario) => scenario.scenario_id === scenarioId)?.required_score ?? null;
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
