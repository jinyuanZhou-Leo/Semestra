// input:  [course gradebook APIs, shadcn UI primitives, and builtin-gradebook shared selectors/formatters]
// output: [table-first builtin-gradebook planning tab component and tab definition]
// pos:    [course-scoped gradebook command center that derives projections from fact data on the client]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronDown,
    Flag,
    MoreHorizontal,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Search,
    Sparkles,
    Target,
    Trash2,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import api, {
    type CourseGradebook,
    type GradebookAssessment,
    type GradebookAssessmentCategory,
    type GradebookAssessmentScenarioScore,
    type GradebookAssessmentStatus,
    type GradebookFeasibility,
    type GradebookForecastMode,
} from '@/services/api';
import type { TabDefinition, TabProps } from '@/services/tabRegistry';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ResponsiveDialogDrawer } from '@/components/ResponsiveDialogDrawer';
import { cn } from '@/lib/utils';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    buildComputedGradebookSummary,
    DEFAULT_GRADEBOOK_VIEW_SETTINGS,
    type ComputedGradebookSummary,
    formatGpa,
    formatGradebookDateInput,
    formatPercent,
    getApiErrorMessage,
    getAssessmentDisplayScore,
    getCategoryBadgeClassName,
    getCategoryById,
    getFeasibilityLabel,
    getScenarioRequiredScore,
    getScenarioSwatchClassName,
    getSelectedScenarioId,
    normalizeGradebookViewSettings,
    type GradebookViewSettings,
} from './shared';

type AssessmentDraft = {
    id: string | null;
    title: string;
    category_id: string | null;
    due_date: string;
    weight: string;
    status: GradebookAssessmentStatus;
    forecast_mode: GradebookForecastMode;
    actual_score: string;
    scenario_scores: Record<string, string>;
};

const ASSESSMENT_FILTER_OPTIONS: Array<{
    value: GradebookViewSettings['filters'];
    label: string;
}> = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'missing_due', label: 'Missing Due Date' },
    { value: 'completed', label: 'Completed' },
    { value: 'excluded', label: 'Excluded' },
];

const getFeasibilityStatTone = (feasibility: GradebookFeasibility) => {
    switch (feasibility) {
        case 'already_secured':
            return 'teal';
        case 'on_track':
            return 'emerald';
        case 'needs_perfection':
            return 'amber';
        case 'infeasible':
            return 'rose';
        default:
            return 'default';
    }
};

const createAssessmentDraft = (
    gradebook: CourseGradebook,
    assessment?: GradebookAssessment | null,
): AssessmentDraft => ({
    id: assessment?.id ?? null,
    title: assessment?.title ?? '',
    category_id: assessment?.category_id ?? gradebook.categories.find((category) => !category.is_archived)?.id ?? null,
    due_date: formatGradebookDateInput(assessment?.due_date),
    weight: assessment ? String(assessment.weight) : '',
    status: assessment?.status ?? 'planned',
    forecast_mode: assessment?.forecast_mode ?? 'manual',
    actual_score: assessment?.actual_score === null || assessment?.actual_score === undefined ? '' : String(assessment.actual_score),
    scenario_scores: Object.fromEntries(
        gradebook.scenarios.map((scenario) => [
            scenario.id,
            String(assessment?.scenario_scores.find((score) => score.scenario_id === scenario.id)?.forecast_score ?? ''),
        ]),
    ),
});

const parseOptionalNumber = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
    label: string;
    value: string;
    subValue?: string;
    hint?: string;
    tone?: 'default' | 'teal' | 'emerald' | 'amber' | 'rose';
}> = ({ label, value, subValue, hint, tone = 'default' }) => {
    const toneClass: Record<string, string> = {
        default: 'border-border/60 bg-card',
        teal: 'border-teal-200/60 bg-teal-50/50 dark:border-teal-900/40 dark:bg-teal-950/30',
        emerald: 'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/30',
        amber: 'border-amber-200/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/30',
        rose: 'border-rose-200/60 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/30',
    };

    return (
        <div className={cn('rounded-xl border p-4 space-y-1.5 transition-colors', toneClass[tone])}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {label}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight text-foreground leading-none">{value}</span>
                {subValue ? (
                    <span className="text-sm text-muted-foreground tabular-nums">{subValue}</span>
                ) : null}
            </div>
            {hint ? (
                <div className="text-[11px] text-muted-foreground/70 leading-tight">{hint}</div>
            ) : null}
        </div>
    );
};

// ── Sortable Table Head ───────────────────────────────────────────────────────

const SortableHead: React.FC<{
    label: string;
    sortKey?: GradebookViewSettings['sortKey'];
    currentSortKey: GradebookViewSettings['sortKey'];
    currentDirection: GradebookViewSettings['sortDirection'];
    onRequestSort: (sortKey: GradebookViewSettings['sortKey']) => void;
    align?: 'left' | 'right';
    className?: string;
}> = ({ label, sortKey, currentSortKey, currentDirection, onRequestSort, align = 'left', className }) => {
    const isActive = sortKey && currentSortKey === sortKey;
    const icon = !sortKey
        ? null
        : isActive
            ? currentDirection === 'asc'
                ? <ArrowUp className="h-3 w-3" />
                : <ArrowDown className="h-3 w-3" />
            : <ArrowUpDown className="h-3 w-3 opacity-40" />;

    return (
        <TableHead
            className={cn(
                'h-10 text-[11px] font-semibold uppercase tracking-[0.08em]',
                sortKey ? 'cursor-pointer select-none hover:text-foreground transition-colors' : '',
                align === 'right' ? 'text-right' : '',
                className,
            )}
            onClick={sortKey ? () => onRequestSort(sortKey) : undefined}
        >
            <div className={cn('flex items-center gap-1.5', align === 'right' ? 'justify-end' : '')}>
                <span>{label}</span>
                {icon}
            </div>
        </TableHead>
    );
};

// ── Assessment Dialog ─────────────────────────────────────────────────────────

const GradebookAssessmentDialog: React.FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draft: AssessmentDraft;
    onDraftChange: React.Dispatch<React.SetStateAction<AssessmentDraft | null>>;
    onSave: () => Promise<void>;
    onDelete?: (() => Promise<void>) | null;
    categories: GradebookAssessmentCategory[];
    scenarios: CourseGradebook['scenarios'];
    isSaving: boolean;
}> = ({ open, onOpenChange, draft, onDraftChange, onSave, onDelete, categories, scenarios, isSaving }) => {
    const setField = <K extends keyof AssessmentDraft>(field: K, value: AssessmentDraft[K]) => {
        onDraftChange((current) => current ? { ...current, [field]: value } : current);
    };

    return (
        <ResponsiveDialogDrawer
            open={open}
            onOpenChange={onOpenChange}
            title={draft.id ? 'Edit Assessment' : 'Add Assessment'}
            description="Keep weights, due dates, and scenario forecasts aligned in one place."
            desktopContentClassName="sm:max-w-3xl gap-0"
            mobileContentClassName="max-h-[90vh] gap-0"
            desktopHeaderClassName="border-b px-6 py-5"
            mobileHeaderClassName="border-b px-6 py-5"
            desktopFooterClassName="border-t px-6 py-4"
            mobileFooterClassName="border-t px-6 py-4 flex-row justify-between"
            footer={(
                <div className="flex w-full items-center justify-between gap-3">
                    <div>
                        {onDelete ? (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => void onDelete()}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? 'Saving…' : 'Save Assessment'}
                        </Button>
                    </div>
                </div>
            )}
        >
            <div className="space-y-6 px-6 py-5">
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Title</span>
                        <Input
                            value={draft.title}
                            onChange={(event) => setField('title', event.target.value)}
                            placeholder="Final exam"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Category</span>
                        <Select
                            value={draft.category_id ?? 'none'}
                            onValueChange={(value) => setField('category_id', value === 'none' ? null : value)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No category</SelectItem>
                                {categories.filter((category) => !category.is_archived).map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Due Date</span>
                        <Input
                            type="date"
                            value={draft.due_date}
                            onChange={(event) => setField('due_date', event.target.value)}
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Weight (%)</span>
                        <Input
                            value={draft.weight}
                            inputMode="decimal"
                            onChange={(event) => setField('weight', event.target.value)}
                            placeholder="20"
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Status</span>
                        <Select
                            value={draft.status}
                            onValueChange={(value) => setField('status', value as GradebookAssessmentStatus)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="planned">Planned</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="excluded">Excluded</SelectItem>
                            </SelectContent>
                        </Select>
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Forecast Mode</span>
                        <Select
                            value={draft.forecast_mode}
                            onValueChange={(value) => setField('forecast_mode', value as GradebookForecastMode)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a forecast mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="solver">Solver</SelectItem>
                            </SelectContent>
                        </Select>
                    </label>
                </div>

                <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Actual Score</span>
                    <Input
                        value={draft.actual_score}
                        inputMode="decimal"
                        onChange={(event) => setField('actual_score', event.target.value)}
                        placeholder="Leave empty until graded"
                    />
                </label>

                {scenarios.length > 0 ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-foreground">Scenario Forecasts</div>
                                <div className="text-xs text-muted-foreground">
                                    Enter forecast scores for each planning scenario.
                                </div>
                            </div>
                            <Badge variant="outline" className="shrink-0">{scenarios.length} scenarios</Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {scenarios.map((scenario) => (
                                <label
                                    key={scenario.id}
                                    className="space-y-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn('h-2 w-2 rounded-full', getScenarioSwatchClassName(scenario.color_token))} />
                                            <span className="text-sm font-medium text-foreground">{scenario.name}</span>
                                        </div>
                                        {scenario.is_baseline ? <Badge variant="secondary" className="text-[10px]">Baseline</Badge> : null}
                                    </div>
                                    <Input
                                        value={draft.scenario_scores[scenario.id] ?? ''}
                                        inputMode="decimal"
                                        onChange={(event) => onDraftChange((current) => {
                                            if (!current) return current;
                                            return {
                                                ...current,
                                                scenario_scores: {
                                                    ...current.scenario_scores,
                                                    [scenario.id]: event.target.value,
                                                },
                                            };
                                        })}
                                        placeholder={draft.forecast_mode === 'solver' ? 'Solver managed' : 'Forecast score'}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </ResponsiveDialogDrawer>
    );
};

// ── Main Tab ──────────────────────────────────────────────────────────────────

const BuiltinGradebookTab: React.FC<TabProps> = ({ courseId, settings, updateSettings }) => {
    const [gradebook, setGradebook] = React.useState<CourseGradebook | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [assessmentDraft, setAssessmentDraft] = React.useState<AssessmentDraft | null>(null);
    const [isAssessmentDialogOpen, setIsAssessmentDialogOpen] = React.useState(false);
    const [isMutating, setIsMutating] = React.useState(false);
    const [assessmentSearchQuery, setAssessmentSearchQuery] = React.useState('');
    const [targetDraft, setTargetDraft] = React.useState('');
    const deferredAssessmentSearchQuery = React.useDeferredValue(assessmentSearchQuery);

    const viewSettings = React.useMemo<GradebookViewSettings>(() => normalizeGradebookViewSettings(settings), [settings]);

    const pushViewSettings = React.useCallback((patch: Partial<GradebookViewSettings>) => {
        void updateSettings({ ...viewSettings, ...patch });
    }, [updateSettings, viewSettings]);

    const loadGradebook = React.useCallback(async () => {
        if (!courseId) return;
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await api.getCourseGradebook(courseId);
            setGradebook(response);
        } catch (error) {
            console.error('Failed to load gradebook tab', error);
            setErrorMessage('Failed to load the course gradebook.');
        } finally {
            setIsLoading(false);
        }
    }, [courseId]);

    React.useEffect(() => {
        void loadGradebook();
    }, [loadGradebook]);

    React.useEffect(() => {
        if (!gradebook || document.activeElement?.id === 'target-input') return;
        setTargetDraft(String(gradebook.target_value));
    }, [gradebook]);

    const commitGradebook = React.useCallback(async (promise: Promise<CourseGradebook>) => {
        setIsMutating(true);
        try {
            const response = await promise;
            setGradebook(response);
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            toast.error(getApiErrorMessage(error));
        } finally {
            setIsMutating(false);
        }
    }, []);

    const selectedScenarioId = gradebook ? getSelectedScenarioId(gradebook, viewSettings) : null;
    const categoriesById = React.useMemo(
        () => new Map((gradebook?.categories ?? []).map((category) => [category.id, category])),
        [gradebook?.categories],
    );
    const computedSummary = React.useMemo<ComputedGradebookSummary | null>(
        () => (gradebook ? buildComputedGradebookSummary(gradebook) : null),
        [gradebook],
    );

    const requestSort = React.useCallback((sortKey: GradebookViewSettings['sortKey']) => {
        pushViewSettings({
            sortKey,
            sortDirection: viewSettings.sortKey === sortKey && viewSettings.sortDirection === 'asc' ? 'desc' : 'asc',
        });
    }, [pushViewSettings, viewSettings.sortDirection, viewSettings.sortKey]);

    const filteredAssessments = React.useMemo(() => {
        if (!gradebook) return [];
        const normalizedQuery = deferredAssessmentSearchQuery.trim().toLowerCase();
        const items = [...gradebook.assessments];
        const filtered = items.filter((assessment) => {
            const categoryName = categoriesById.get(assessment.category_id ?? '')?.name.toLowerCase() ?? '';
            const matchesSearch = !normalizedQuery
                || assessment.title.toLowerCase().includes(normalizedQuery)
                || categoryName.includes(normalizedQuery);

            if (!matchesSearch) return false;

            switch (viewSettings.filters) {
                case 'upcoming':
                    return assessment.status === 'planned' && Boolean(assessment.due_date);
                case 'missing_due':
                    return assessment.status !== 'excluded' && !assessment.due_date;
                case 'completed':
                    return assessment.status === 'completed';
                case 'excluded':
                    return assessment.status === 'excluded';
                case 'all':
                default:
                    return true;
            }
        });

        filtered.sort((left, right) => {
            const direction = viewSettings.sortDirection === 'asc' ? 1 : -1;
            switch (viewSettings.sortKey) {
                case 'type': {
                    const leftName = categoriesById.get(left.category_id ?? '')?.name ?? '';
                    const rightName = categoriesById.get(right.category_id ?? '')?.name ?? '';
                    return leftName.localeCompare(rightName) * direction;
                }
                case 'weight':
                    return (left.weight - right.weight) * direction;
                case 'status':
                    return left.status.localeCompare(right.status) * direction;
                case 'title':
                    return left.title.localeCompare(right.title) * direction;
                case 'due_date':
                default: {
                    const leftValue = left.due_date ?? '9999-12-31';
                    const rightValue = right.due_date ?? '9999-12-31';
                    return leftValue.localeCompare(rightValue) * direction;
                }
            }
        });

        return filtered;
    }, [categoriesById, deferredAssessmentSearchQuery, gradebook, viewSettings.filters, viewSettings.sortDirection, viewSettings.sortKey]);

    const handleSaveAssessment = async () => {
        if (!courseId || !gradebook || !assessmentDraft) return;
        const scenarioScores: GradebookAssessmentScenarioScore[] = gradebook.scenarios.map((scenario) => ({
            scenario_id: scenario.id,
            forecast_score: parseOptionalNumber(assessmentDraft.scenario_scores[scenario.id] ?? ''),
        }));

        const payload = {
            category_id: assessmentDraft.category_id,
            title: assessmentDraft.title.trim(),
            due_date: assessmentDraft.due_date || null,
            weight: Number(assessmentDraft.weight) || 0,
            status: assessmentDraft.status,
            forecast_mode: assessmentDraft.forecast_mode,
            actual_score: parseOptionalNumber(assessmentDraft.actual_score),
            scenario_scores: scenarioScores,
        };

        if (!payload.title) {
            toast.error('Assessment title is required.');
            return;
        }

        if (assessmentDraft.id) {
            await commitGradebook(
                api.updateCourseGradebookAssessment(courseId, assessmentDraft.id, payload),
            );
        } else {
            await commitGradebook(
                api.createCourseGradebookAssessment(courseId, payload),
            );
        }
        setIsAssessmentDialogOpen(false);
        setAssessmentDraft(null);
    };

    const handleDeleteAssessment = async () => {
        if (!courseId || !gradebook || !assessmentDraft?.id) return;
        await commitGradebook(
            api.deleteCourseGradebookAssessment(courseId, assessmentDraft.id),
        );
        setIsAssessmentDialogOpen(false);
        setAssessmentDraft(null);
    };

    const handleSaveTarget = React.useCallback(async () => {
        if (!courseId || !gradebook) return;
        const nextValue = Number(targetDraft);
        if (!Number.isFinite(nextValue)) {
            toast.error('Enter a valid target value.');
            setTargetDraft(String(gradebook.target_value));
            return;
        }
        if (nextValue === gradebook.target_value) return;
        await commitGradebook(api.updateCourseGradebookTarget(courseId, {
            target_mode: gradebook.target_mode,
            target_value: nextValue,
        }));
    }, [commitGradebook, courseId, gradebook, targetDraft]);

    // ── Empty / Error States ───────────────────────────────────────────────────

    if (!courseId) {
        return (
            <Empty className="bg-muted/40">
                <EmptyHeader>
                    <EmptyTitle>Gradebook unavailable</EmptyTitle>
                    <EmptyDescription>This tab requires a course context.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-56 w-full rounded-2xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-[480px] w-full rounded-2xl" />
            </div>
        );
    }

    if (!gradebook || errorMessage) {
        return (
            <Empty className="border-border/70 bg-muted/40">
                <EmptyHeader>
                    <EmptyTitle>Gradebook failed to load</EmptyTitle>
                    <EmptyDescription>{errorMessage ?? 'Unknown error.'}</EmptyDescription>
                </EmptyHeader>
                <div className="px-6 pb-6">
                    <Button type="button" onClick={() => void loadGradebook()}>
                        Retry
                    </Button>
                </div>
            </Empty>
        );
    }

    // ── Derived values ─────────────────────────────────────────────────────────

    const selectedScenario = gradebook.scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? gradebook.scenarios[0] ?? null;
    const selectedScenarioCard = computedSummary?.scenario_cards.find((scenario) => scenario.scenario_id === selectedScenario?.id) ?? null;
    const selectedScenarioRequiredScore = computedSummary ? getScenarioRequiredScore(computedSummary, selectedScenario?.id ?? null) : null;
    const completedCount = gradebook.assessments.filter((assessment) => assessment.status === 'completed').length;
    const plannedCount = gradebook.assessments.filter((assessment) => assessment.status === 'planned').length;
    const selectedScenarioProjection = selectedScenarioCard?.projected_percentage ?? computedSummary?.baseline_projected_percentage ?? null;
    const selectedScenarioProjectedGpa = selectedScenarioCard?.projected_gpa ?? computedSummary?.baseline_projected_gpa ?? null;
    const selectedScenarioRemainingWeight = selectedScenarioCard?.remaining_weight ?? computedSummary?.remaining_weight ?? 0;
    const selectedScenarioFeasibility = selectedScenarioCard?.feasibility ?? computedSummary?.feasibility ?? 'invalid';
    const feasibilityTone = getFeasibilityStatTone(selectedScenarioFeasibility);

    const hasActiveFilters = viewSettings.filters !== 'all' || assessmentSearchQuery.trim();

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <TooltipProvider>
            <div className="space-y-4">
                {/* ── Assessments Card ────────────────────────────────────────── */}
                <Card className="border-border/60 bg-card shadow-none">
                    {/* Toolbar */}
                    <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Left: Search + Filter + Count */}
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                            <div className="relative flex-1 max-w-72">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={assessmentSearchQuery}
                                    onChange={(event) => setAssessmentSearchQuery(event.target.value)}
                                    placeholder="Search assessments…"
                                    className="pl-9 h-9 bg-muted/30 border-border/60 focus-visible:bg-background"
                                />
                                {assessmentSearchQuery ? (
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => setAssessmentSearchQuery('')}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                ) : null}
                            </div>

                            <Select
                                value={viewSettings.filters}
                                onValueChange={(value) => pushViewSettings({ filters: value as GradebookViewSettings['filters'] })}
                            >
                                <SelectTrigger className={cn('h-9 w-auto min-w-[100px] border-border/60 bg-muted/30 text-sm', viewSettings.filters !== 'all' ? 'border-primary/50 bg-primary/5 text-primary' : '')}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ASSESSMENT_FILTER_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {hasActiveFilters ? (
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                    {filteredAssessments.length} shown
                                </span>
                            ) : (
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                    {gradebook.assessments.length} total
                                </span>
                            )}
                        </div>

                        {/* Right: Bulk Actions + Add */}
                        <div className="flex items-center gap-2 shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="h-9 border-border/60">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem
                                        onSelect={() => void commitGradebook(
                                            api.convertCourseGradebookToSolver(courseId, {
                                                assessment_ids: gradebook.assessments
                                                    .filter((a) => a.status === 'planned')
                                                    .map((a) => a.id),
                                            }),
                                        )}
                                        disabled={isMutating}
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Convert Planned to Solver
                                    </DropdownMenuItem>
                                    {selectedScenario ? (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onSelect={() => void commitGradebook(
                                                    api.applyCourseGradebookSolvedScore(courseId, {
                                                        scenario_id: selectedScenario.id,
                                                        assessment_ids: gradebook.assessments
                                                            .filter((a) => a.forecast_mode === 'solver' && a.status === 'planned')
                                                            .map((a) => a.id),
                                                    }),
                                                )}
                                                disabled={isMutating}
                                            >
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Apply Solver Results
                                            </DropdownMenuItem>
                                        </>
                                    ) : null}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                                type="button"
                                size="sm"
                                className="h-9"
                                onClick={() => {
                                    setAssessmentDraft(createAssessmentDraft(gradebook));
                                    setIsAssessmentDialogOpen(true);
                                }}
                            >
                                <Plus className="mr-1.5 h-4 w-4" />
                                Add
                            </Button>
                        </div>
                    </div>

                    <CardContent className="p-0 border-t border-border/50">
                        {filteredAssessments.length === 0 ? (
                            <div className="px-5 py-6">
                                <Empty className="min-h-56 border-border/70 bg-muted/30">
                                    <EmptyHeader>
                                        <EmptyTitle>
                                            {hasActiveFilters ? 'No assessments found' : 'No assessments yet'}
                                        </EmptyTitle>
                                        <EmptyDescription>
                                            {hasActiveFilters
                                                ? 'Adjust the search or filters to see more assessment rows.'
                                                : 'Add your first assessment to start tracking weights and projected scores.'}
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        {!hasActiveFilters ? (
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    setAssessmentDraft(createAssessmentDraft(gradebook));
                                                    setIsAssessmentDialogOpen(true);
                                                }}
                                            >
                                                <Plus className="mr-1.5 h-4 w-4" />
                                                Add Assessment
                                            </Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setAssessmentSearchQuery('');
                                                    pushViewSettings({ filters: 'all' });
                                                }}
                                            >
                                                Clear Filters
                                            </Button>
                                        )}
                                    </EmptyContent>
                                </Empty>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-b border-border/40">
                                        <SortableHead
                                            label="Name"
                                            sortKey="title"
                                            currentSortKey={viewSettings.sortKey}
                                            currentDirection={viewSettings.sortDirection}
                                            onRequestSort={requestSort}
                                            className="pl-5"
                                        />
                                        <SortableHead
                                            label="Weight"
                                            sortKey="weight"
                                            currentSortKey={viewSettings.sortKey}
                                            currentDirection={viewSettings.sortDirection}
                                            onRequestSort={requestSort}
                                            align="right"
                                        />
                                        <SortableHead
                                            label="Category"
                                            sortKey="type"
                                            currentSortKey={viewSettings.sortKey}
                                            currentDirection={viewSettings.sortDirection}
                                            onRequestSort={requestSort}
                                        />
                                        <TableHead className="text-right">Score</TableHead>
                                        <TableHead className="w-16 pr-5 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAssessments.map((assessment) => {
                                        const category = getCategoryById(gradebook.categories, assessment.category_id);
                                        const displayScore = getAssessmentDisplayScore(assessment, selectedScenario?.id ?? null);

                                        return (
                                            <TableRow
                                                key={assessment.id}
                                                className="hover:bg-muted/30 border-b border-border/30 last:border-0 align-middle"
                                            >
                                                <TableCell className="pl-5 py-3 min-w-[220px]">
                                                    <div className="text-sm font-medium text-foreground leading-snug">
                                                        {assessment.title}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 text-right tabular-nums">
                                                    <span className="text-sm font-medium text-foreground">
                                                        {formatPercent(assessment.weight)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    {category ? (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn('px-2 py-0 text-[10px] font-medium', getCategoryBadgeClassName(category.color_token))}
                                                        >
                                                            {category.name}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/50">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-3 text-right">
                                                    <div className="space-y-0.5">
                                                        <div className="text-sm font-semibold tabular-nums text-foreground">
                                                            {displayScore === null ? (
                                                                <span className="text-muted-foreground/50 font-normal">—</span>
                                                            ) : formatPercent(displayScore)}
                                                        </div>
                                                        {displayScore !== null ? (
                                                            <div className="text-[11px] text-muted-foreground/60">
                                                                {assessment.status === 'completed'
                                                                    ? 'Actual'
                                                                    : assessment.forecast_mode === 'solver'
                                                                        ? 'Solver'
                                                                        : 'Forecast'}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 pr-5 text-right">
                                                    <Button
                                                        type="button"
                                                        size="icon-sm"
                                                        variant="ghost"
                                                        className="h-7 w-7"
                                                        onClick={() => {
                                                            setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                                            setIsAssessmentDialogOpen(true);
                                                        }}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* ── Validation Alert ────────────────────────────────────────── */}
                {computedSummary && computedSummary.validation_issues.length > 0 ? (
                    <Alert className="border-destructive/25 bg-destructive/5 text-destructive py-3 px-4">
                        <Flag className="h-4 w-4 shrink-0" />
                        <AlertDescription className="text-sm">
                            <span className="font-semibold">Validation issues: </span>
                            {computedSummary.validation_issues.join(' · ')}
                        </AlertDescription>
                    </Alert>
                ) : null}

                {/* ── Overview Card ───────────────────────────────────────────── */}
                <Card className="border-border/60 bg-card shadow-none">
                    <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4">
                        <div className="flex items-center gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-sm hover:bg-muted/60 hover:border-border transition-colors"
                                        onClick={() => void commitGradebook(
                                            api.updateCourseGradebookTarget(courseId, {
                                                target_mode: gradebook.target_mode === 'percentage' ? 'gpa' : 'percentage',
                                                target_value: gradebook.target_value,
                                            }),
                                        )}
                                    >
                                        <Target className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            {gradebook.target_mode === 'gpa' ? 'GPA' : '%'}
                                        </span>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Toggle target mode</TooltipContent>
                            </Tooltip>
                            <Input
                                id="target-input"
                                className="h-8 w-20 border-border/60 bg-muted/20 px-2 text-sm font-semibold tracking-tight focus-visible:ring-1 focus-visible:ring-primary/50"
                                value={targetDraft}
                                inputMode="decimal"
                                onChange={(e) => setTargetDraft(e.target.value)}
                                onBlur={() => void handleSaveTarget()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                    }
                                }}
                                placeholder={gradebook.target_mode === 'gpa' ? '4.0' : '85'}
                            />
                        </div>

                        {gradebook.scenarios.length > 0 ? (
                            <Select
                                value={selectedScenarioId ?? ''}
                                onValueChange={(val) => pushViewSettings({ selectedScenarioId: val })}
                            >
                                <SelectTrigger className="h-8 w-[184px] border-border/60 bg-muted/20 text-sm font-medium">
                                    <SelectValue placeholder="Select scenario" />
                                </SelectTrigger>
                                <SelectContent>
                                    {gradebook.scenarios.map((scenario) => (
                                        <SelectItem key={scenario.id} value={scenario.id}>
                                            <div className="flex items-center gap-2">
                                                <span className={cn('h-2 w-2 rounded-full shrink-0', getScenarioSwatchClassName(scenario.color_token))} />
                                                <span>{scenario.name}</span>
                                                {scenario.is_baseline ? (
                                                    <span className="text-[10px] text-muted-foreground">(Baseline)</span>
                                                ) : null}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : null}
                    </div>

                    <CardContent className="px-5 pb-5 pt-0">
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <StatCard
                                label="Actual Score"
                                value={formatPercent(computedSummary?.current_actual_percentage)}
                                subValue={formatGpa(computedSummary?.current_actual_gpa)}
                                hint={`${completedCount} of ${gradebook.assessments.length} completed`}
                            />
                            <StatCard
                                label={`Projected · ${selectedScenario?.name ?? 'Baseline'}`}
                                value={formatPercent(selectedScenarioProjection)}
                                subValue={formatGpa(selectedScenarioProjectedGpa)}
                                hint={getFeasibilityLabel(selectedScenarioFeasibility)}
                                tone={feasibilityTone}
                            />
                            <StatCard
                                label="Required Avg"
                                value={selectedScenarioRequiredScore === null ? 'N/A' : formatPercent(selectedScenarioRequiredScore)}
                                hint="Average score needed going forward"
                            />
                            <StatCard
                                label="Remaining Weight"
                                value={formatPercent(selectedScenarioRemainingWeight)}
                                hint={`${plannedCount} planned item${plannedCount !== 1 ? 's' : ''} pending`}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ── Assessment Dialog ───────────────────────────────────────── */}
                {assessmentDraft ? (
                    <GradebookAssessmentDialog
                        open={isAssessmentDialogOpen}
                        onOpenChange={(open) => {
                            setIsAssessmentDialogOpen(open);
                            if (!open) {
                                setAssessmentDraft(null);
                            }
                        }}
                        draft={assessmentDraft}
                        onDraftChange={setAssessmentDraft}
                        onSave={handleSaveAssessment}
                        onDelete={assessmentDraft.id ? handleDeleteAssessment : null}
                        categories={gradebook.categories}
                        scenarios={gradebook.scenarios}
                        isSaving={isMutating}
                    />
                ) : null}
            </div>
        </TooltipProvider>
    );
};

export const BuiltinGradebookTabDefinition: TabDefinition = {
    type: BUILTIN_GRADEBOOK_TAB_TYPE,
    component: BuiltinGradebookTab,
    defaultSettings: DEFAULT_GRADEBOOK_VIEW_SETTINGS,
};
