// input:  [course gradebook APIs, course data refresh helpers, shadcn UI primitives, and builtin-gradebook shared selectors/formatters]
// output: [builtin-gradebook planning tab component and tab definition]
// pos:    [course-scoped gradebook command center for scenario planning, assessment search/sort, category setup, and summary triage]
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
    Flag,
    Layers3,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Search,
    Sparkles,
    Star,
    Target,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import api, {
    type CourseGradebook,
    type GradebookAssessment,
    type GradebookAssessmentCategory,
    type GradebookAssessmentScenarioScore,
    type GradebookAssessmentStatus,
    type GradebookForecastMode,
    type GradebookTargetMode,
} from '@/services/api';
import type { TabDefinition, TabProps } from '@/services/tabRegistry';
import { useCourseData } from '@/contexts/CourseDataContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveDialogDrawer } from '@/components/ResponsiveDialogDrawer';
import { cn } from '@/lib/utils';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    CATEGORY_COLOR_OPTIONS,
    DEFAULT_GRADEBOOK_VIEW_SETTINGS,
    formatGpa,
    formatGradebookDate,
    formatGradebookDateInput,
    formatPercent,
    getApiErrorMessage,
    getAssessmentDisplayScore,
    getAssessmentStatusLabel,
    getCategoryBadgeClassName,
    getCategoryById,
    getFeasibilityBadgeClassName,
    getFeasibilityLabel,
    getRelativeDueText,
    getScenarioRequiredScore,
    getScenarioSwatchClassName,
    getSelectedScenarioId,
    isAssessmentOverdue,
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
    notes: string;
    scenario_scores: Record<string, string>;
};

const ASSESSMENT_FILTER_OPTIONS: Array<{
    value: GradebookViewSettings['filters'];
    label: string;
    description: string;
}> = [
    { value: 'all', label: 'All', description: 'Every assessment in this course.' },
    { value: 'upcoming', label: 'Upcoming', description: 'Planned work with a due date.' },
    { value: 'missing_due', label: 'Missing Due Date', description: 'Items that still need a deadline.' },
    { value: 'completed', label: 'Completed', description: 'Finished assessments with locked actual scores.' },
    { value: 'excluded', label: 'Excluded', description: 'Items removed from projection calculations.' },
];

const getStatusBadgeClassName = (status: GradebookAssessmentStatus) => {
    switch (status) {
        case 'completed':
            return 'border-emerald-200/80 bg-emerald-100 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/70 dark:text-emerald-200';
        case 'excluded':
            return 'border-slate-200/80 bg-slate-100 text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/70 dark:text-slate-200';
        case 'planned':
        default:
            return 'border-amber-200/80 bg-amber-100 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/70 dark:text-amber-200';
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
    notes: assessment?.notes ?? '',
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

const PlannerStatCard: React.FC<{
    label: string;
    value: string;
    hint?: string;
    tone?: 'default' | 'accent';
}> = ({ label, value, hint, tone = 'default' }) => (
    <div
        className={cn(
            'rounded-2xl border px-4 py-3',
            tone === 'accent'
                ? 'border-primary/20 bg-primary/5'
                : 'border-border/70 bg-background/85',
        )}
    >
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="mt-2 text-lg font-semibold tracking-tight text-foreground">{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
);

const SortableHead: React.FC<{
    label: string;
    sortKey?: GradebookViewSettings['sortKey'];
    currentSortKey: GradebookViewSettings['sortKey'];
    currentDirection: GradebookViewSettings['sortDirection'];
    onRequestSort: (sortKey: GradebookViewSettings['sortKey']) => void;
    align?: 'left' | 'right';
    className?: string;
}> = ({ label, sortKey, currentSortKey, currentDirection, onRequestSort, align = 'left', className }) => {
    const icon = !sortKey || currentSortKey !== sortKey
        ? <ArrowUpDown className="h-4 w-4 text-muted-foreground/60" />
        : currentDirection === 'asc'
            ? <ArrowUp className="h-4 w-4 text-foreground" />
            : <ArrowDown className="h-4 w-4 text-foreground" />;

    return (
        <TableHead
            className={cn(
                sortKey ? 'cursor-pointer select-none hover:bg-muted/40 transition-colors' : '',
                align === 'right' ? 'text-right' : '',
                className,
            )}
            onClick={sortKey ? () => onRequestSort(sortKey) : undefined}
        >
            <div className={cn('flex items-center gap-2', align === 'right' ? 'justify-end' : '')}>
                <span>{label}</span>
                {sortKey ? icon : null}
            </div>
        </TableHead>
    );
};

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
            description="Keep weights, due dates, scenario forecasts, and notes aligned in one place."
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
                            {isSaving ? 'Saving...' : 'Save Assessment'}
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

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-medium text-foreground">Scenario Forecasts</div>
                            <div className="text-xs text-muted-foreground">
                                Enter forecast scores for each planning scenario.
                            </div>
                        </div>
                        <Badge variant="outline">{scenarios.length} scenarios</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {scenarios.map((scenario) => (
                            <label
                                key={scenario.id}
                                className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={cn('h-2.5 w-2.5 rounded-full', getScenarioSwatchClassName(scenario.color_token))} />
                                        <span className="text-sm font-medium text-foreground">{scenario.name}</span>
                                    </div>
                                    {scenario.is_baseline ? <Badge variant="secondary">Baseline</Badge> : null}
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

                <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Notes</span>
                    <Textarea
                        value={draft.notes}
                        onChange={(event) => setField('notes', event.target.value)}
                        className="min-h-28"
                        placeholder="Context for grading, assumptions, or reminders."
                    />
                </label>
            </div>
        </ResponsiveDialogDrawer>
    );
};

const BuiltinGradebookTab: React.FC<TabProps> = ({ courseId, settings, updateSettings }) => {
    const { refreshCourse } = useCourseData();
    const [gradebook, setGradebook] = React.useState<CourseGradebook | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [assessmentDraft, setAssessmentDraft] = React.useState<AssessmentDraft | null>(null);
    const [isAssessmentDialogOpen, setIsAssessmentDialogOpen] = React.useState(false);
    const [isMutating, setIsMutating] = React.useState(false);
    const [assessmentSearchQuery, setAssessmentSearchQuery] = React.useState('');
    const [targetDraft, setTargetDraft] = React.useState('');
    const [managementTab, setManagementTab] = React.useState<'scenarios' | 'categories'>('scenarios');
    const [newScenarioName, setNewScenarioName] = React.useState('');
    const [newCategoryName, setNewCategoryName] = React.useState('');
    const [newCategoryColor, setNewCategoryColor] = React.useState<string>(CATEGORY_COLOR_OPTIONS[0].value);
    const [editingScenarioId, setEditingScenarioId] = React.useState<string | null>(null);
    const [editingScenarioName, setEditingScenarioName] = React.useState('');
    const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = React.useState('');
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
        if (!gradebook) return;
        setTargetDraft(String(gradebook.target_value));
    }, [gradebook]);

    const commitGradebook = React.useCallback(async (promise: Promise<CourseGradebook>, successMessage?: string) => {
        setIsMutating(true);
        try {
            const response = await promise;
            setGradebook(response);
            await refreshCourse();
            if (successMessage) {
                toast.success(successMessage);
            }
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            if (
                typeof error === 'object'
                && error !== null
                && 'response' in error
                && (error as { response?: { status?: number } }).response?.status === 409
            ) {
                toast.error('Gradebook revision conflict. Reloading the latest data.');
                await loadGradebook();
                return;
            }
            toast.error(getApiErrorMessage(error));
        } finally {
            setIsMutating(false);
        }
    }, [loadGradebook, refreshCourse]);

    const selectedScenarioId = gradebook ? getSelectedScenarioId(gradebook, viewSettings) : null;
    const categoriesById = React.useMemo(
        () => new Map((gradebook?.categories ?? []).map((category) => [category.id, category])),
        [gradebook?.categories],
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
                || (assessment.notes ?? '').toLowerCase().includes(normalizedQuery)
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

    const groupedAssessments = React.useMemo(() => {
        if (!gradebook || viewSettings.groupBy !== 'type') {
            return new Map<string, GradebookAssessment[]>([['All Assessments', filteredAssessments]]);
        }
        const groups = new Map<string, GradebookAssessment[]>();
        filteredAssessments.forEach((assessment) => {
            const label = categoriesById.get(assessment.category_id ?? '')?.name ?? 'Uncategorized';
            const current = groups.get(label);
            if (current) {
                current.push(assessment);
            } else {
                groups.set(label, [assessment]);
            }
        });
        return groups;
    }, [categoriesById, filteredAssessments, gradebook, viewSettings.groupBy]);

    const handleSaveAssessment = async () => {
        if (!courseId || !gradebook || !assessmentDraft) return;
        const scenarioScores: GradebookAssessmentScenarioScore[] = gradebook.scenarios.map((scenario) => ({
            scenario_id: scenario.id,
            forecast_score: parseOptionalNumber(assessmentDraft.scenario_scores[scenario.id] ?? ''),
        }));

        const payload = {
            revision: gradebook.revision,
            category_id: assessmentDraft.category_id,
            title: assessmentDraft.title.trim(),
            due_date: assessmentDraft.due_date || null,
            weight: Number(assessmentDraft.weight) || 0,
            status: assessmentDraft.status,
            forecast_mode: assessmentDraft.forecast_mode,
            actual_score: parseOptionalNumber(assessmentDraft.actual_score),
            notes: assessmentDraft.notes || null,
            scenario_scores: scenarioScores,
        };

        if (!payload.title) {
            toast.error('Assessment title is required.');
            return;
        }

        if (assessmentDraft.id) {
            await commitGradebook(
                api.updateCourseGradebookAssessment(courseId, assessmentDraft.id, payload),
                'Assessment updated.',
            );
        } else {
            await commitGradebook(
                api.createCourseGradebookAssessment(courseId, payload),
                'Assessment created.',
            );
        }
        setIsAssessmentDialogOpen(false);
        setAssessmentDraft(null);
    };

    const handleDeleteAssessment = async () => {
        if (!courseId || !gradebook || !assessmentDraft?.id) return;
        await commitGradebook(
            api.deleteCourseGradebookAssessment(courseId, assessmentDraft.id, { revision: gradebook.revision }),
            'Assessment deleted.',
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
            revision: gradebook.revision,
            target_mode: gradebook.target_mode as GradebookTargetMode,
            target_value: nextValue,
        }), 'Target updated.');
    }, [commitGradebook, courseId, gradebook, targetDraft]);

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
            <div className="space-y-5">
                <Skeleton className="h-64 rounded-3xl" />
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <Skeleton className="h-[640px] rounded-3xl" />
                    <Skeleton className="h-[640px] rounded-3xl" />
                </div>
                <Skeleton className="h-[420px] rounded-3xl" />
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

    const selectedScenario = gradebook.scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? gradebook.scenarios[0] ?? null;
    const selectedScenarioCard = gradebook.summary.scenario_cards.find((scenario) => scenario.scenario_id === selectedScenario?.id) ?? null;
    const selectedScenarioRequiredScore = getScenarioRequiredScore(gradebook, selectedScenario?.id ?? null);
    const completionProgress = Math.max(0, Math.min(100, 100 - gradebook.summary.remaining_weight));
    const completedCount = gradebook.assessments.filter((assessment) => assessment.status === 'completed').length;
    const plannedCount = gradebook.assessments.filter((assessment) => assessment.status === 'planned').length;
    const missingDueDateCount = gradebook.assessments.filter((assessment) => assessment.status !== 'excluded' && !assessment.due_date).length;
    const overdueCount = gradebook.assessments.filter((assessment) => isAssessmentOverdue(assessment)).length;
    const selectedScenarioProjection = selectedScenarioCard?.projected_percentage ?? gradebook.summary.baseline_projected_percentage;
    const selectedScenarioProjectedGpa = selectedScenarioCard?.projected_gpa ?? gradebook.summary.baseline_projected_gpa;
    const selectedScenarioRemainingWeight = selectedScenarioCard?.remaining_weight ?? gradebook.summary.remaining_weight;
    const selectedScenarioFeasibility = selectedScenarioCard?.feasibility ?? gradebook.summary.feasibility;

    return (
        <div className="space-y-5">
            <Card className="overflow-hidden border-border/70 bg-card shadow-none">
                <div className="bg-linear-to-br from-teal-500/10 via-background to-orange-500/10">
                    <CardHeader className="gap-5 pb-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="border-border/70 bg-background/80">
                                        Gradebook Planner
                                    </Badge>
                                    <Badge variant="secondary">Revision {gradebook.revision}</Badge>
                                    {selectedScenario ? (
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'border px-2.5 py-1 text-xs font-medium',
                                                getFeasibilityBadgeClassName(selectedScenarioFeasibility),
                                            )}
                                        >
                                            {selectedScenario.name}
                                        </Badge>
                                    ) : null}
                                </div>
                                <div>
                                    <CardTitle className="text-2xl tracking-tight">Plan the course outcome from one surface</CardTitle>
                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                                        The planner is centered on the current scenario, keeps target updates explicit, and makes assessment triage feel closer to the Program Homepage course list.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-[auto_140px_auto]">
                                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-background/80 p-2">
                                    <Button
                                        type="button"
                                        variant={gradebook.target_mode === 'percentage' ? 'default' : 'ghost'}
                                        className="justify-center"
                                        disabled={isMutating}
                                        onClick={() => void commitGradebook(
                                            api.updateCourseGradebookTarget(courseId, {
                                                revision: gradebook.revision,
                                                target_mode: 'percentage',
                                                target_value: gradebook.target_mode === 'percentage' ? gradebook.target_value : 85,
                                            }),
                                            'Target mode updated.',
                                        )}
                                    >
                                        Percentage
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={gradebook.target_mode === 'gpa' ? 'default' : 'ghost'}
                                        className="justify-center"
                                        disabled={isMutating}
                                        onClick={() => void commitGradebook(
                                            api.updateCourseGradebookTarget(courseId, {
                                                revision: gradebook.revision,
                                                target_mode: 'gpa',
                                                target_value: gradebook.target_mode === 'gpa' ? gradebook.target_value : 4,
                                            }),
                                            'Target mode updated.',
                                        )}
                                    >
                                        GPA
                                    </Button>
                                </div>
                                <Input
                                    value={targetDraft}
                                    inputMode="decimal"
                                    onChange={(event) => setTargetDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            void handleSaveTarget();
                                        }
                                    }}
                                    className="bg-background/80"
                                    placeholder={gradebook.target_mode === 'gpa' ? '4.0' : '85'}
                                />
                                <Button
                                    type="button"
                                    className="justify-center"
                                    onClick={() => void handleSaveTarget()}
                                    disabled={isMutating}
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Target
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-5 pb-6">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <PlannerStatCard
                                label="Projected"
                                value={`${formatPercent(selectedScenarioProjection)} · ${formatGpa(selectedScenarioProjectedGpa)} GPA`}
                                hint={selectedScenario ? `Current scenario: ${selectedScenario.name}` : 'Projection unavailable'}
                                tone="accent"
                            />
                            <PlannerStatCard
                                label="Required"
                                value={selectedScenarioRequiredScore === null ? 'N/A' : formatPercent(selectedScenarioRequiredScore)}
                                hint="Course-wide score needed on the remaining assessed weight."
                            />
                            <PlannerStatCard
                                label="Remaining Weight"
                                value={formatPercent(selectedScenarioRemainingWeight)}
                                hint={`${plannedCount} planned assessments still in play`}
                            />
                            <PlannerStatCard
                                label="Track Status"
                                value={getFeasibilityLabel(selectedScenarioFeasibility)}
                                hint={overdueCount > 0 ? `${overdueCount} overdue item${overdueCount === 1 ? '' : 's'} need attention` : 'No overdue assessments'}
                            />
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="rounded-3xl border border-border/70 bg-background/85 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Assessment coverage</div>
                                        <div className="text-xs text-muted-foreground">
                                            Weighted progress based on what is already graded.
                                        </div>
                                    </div>
                                    <div className="text-sm font-medium text-foreground">{completedCount}/{gradebook.assessments.length} completed</div>
                                </div>
                                <Progress value={completionProgress} className="mt-4 h-2.5" />
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    <span>{formatPercent(100 - gradebook.summary.remaining_weight)} graded weight</span>
                                    <span>{missingDueDateCount} missing due date</span>
                                    <span>{gradebook.summary.upcoming_due_items.length} scheduled next</span>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-border/70 bg-background/85 p-4">
                                <div className="text-sm font-medium text-foreground">Target snapshot</div>
                                <div className="mt-2 flex items-center gap-2">
                                    <Target className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-lg font-semibold text-foreground">
                                        {gradebook.target_mode === 'gpa'
                                            ? `${formatGpa(gradebook.target_value)} GPA`
                                            : formatPercent(gradebook.target_value)}
                                    </span>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                    Baseline remains the source of truth for course summary cards, while the active scenario drives planning inside the table below.
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {gradebook.scenarios.map((scenario) => {
                                const card = gradebook.summary.scenario_cards.find((entry) => entry.scenario_id === scenario.id);
                                const isSelected = selectedScenario?.id === scenario.id;
                                return (
                                    <button
                                        key={scenario.id}
                                        type="button"
                                        onClick={() => pushViewSettings({ selectedScenarioId: scenario.id })}
                                        className={cn(
                                            'rounded-3xl border px-4 py-4 text-left transition hover:border-primary/40 hover:bg-background/95',
                                            isSelected
                                                ? 'border-primary/40 bg-background shadow-sm'
                                                : 'border-border/70 bg-background/70',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn('h-2.5 w-2.5 rounded-full', getScenarioSwatchClassName(scenario.color_token))} />
                                                    <div className="text-sm font-semibold text-foreground">{scenario.name}</div>
                                                </div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    {card?.required_score === null || card?.required_score === undefined
                                                        ? 'No required score'
                                                        : `Need ${formatPercent(card.required_score)}`}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {scenario.is_baseline ? <Badge variant="secondary">Baseline</Badge> : null}
                                                {isSelected ? <Badge variant="outline">Active</Badge> : null}
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-end justify-between gap-3">
                                            <div>
                                                <div className="text-xl font-semibold tracking-tight text-foreground">
                                                    {formatPercent(card?.projected_percentage)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{formatGpa(card?.projected_gpa)} GPA</div>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={cn('border px-2 py-1 text-[11px]', getFeasibilityBadgeClassName(card?.feasibility ?? 'invalid'))}
                                            >
                                                {getFeasibilityLabel(card?.feasibility ?? 'invalid')}
                                            </Badge>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </div>
            </Card>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <Card className="border-border/70 bg-card shadow-none">
                    <CardHeader className="space-y-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle className="text-xl tracking-tight">Assessments</CardTitle>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                    Search and sort the assessment list like the Program Homepage course table, while keeping scenario-aware forecast values visible.
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => {
                                    setAssessmentDraft(createAssessmentDraft(gradebook));
                                    setIsAssessmentDialogOpen(true);
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Assessment
                            </Button>
                        </div>

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative w-full lg:max-w-sm">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={assessmentSearchQuery}
                                    onChange={(event) => setAssessmentSearchQuery(event.target.value)}
                                    placeholder="Search assessments, notes, or categories..."
                                    className="pl-9"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={viewSettings.groupBy}
                                    onValueChange={(value) => pushViewSettings({ groupBy: value as GradebookViewSettings['groupBy'] })}
                                >
                                    <SelectTrigger className="min-w-[160px]">
                                        <SelectValue placeholder="Grouping" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No grouping</SelectItem>
                                        <SelectItem value="type">Group by category</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Badge variant="outline" className="border-border/70 bg-background/90">
                                    {filteredAssessments.length} shown
                                </Badge>
                                {selectedScenario ? (
                                    <Badge variant="secondary">{selectedScenario.name}</Badge>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {ASSESSMENT_FILTER_OPTIONS.map((option) => {
                                const count = option.value === 'all'
                                    ? gradebook.assessments.length
                                    : option.value === 'upcoming'
                                        ? gradebook.assessments.filter((assessment) => assessment.status === 'planned' && Boolean(assessment.due_date)).length
                                        : option.value === 'missing_due'
                                            ? gradebook.assessments.filter((assessment) => assessment.status !== 'excluded' && !assessment.due_date).length
                                            : option.value === 'completed'
                                                ? completedCount
                                                : gradebook.assessments.filter((assessment) => assessment.status === 'excluded').length;
                                const isActive = viewSettings.filters === option.value;

                                return (
                                    <Button
                                        key={option.value}
                                        type="button"
                                        variant={isActive ? 'default' : 'outline'}
                                        className="h-auto min-h-11 items-start rounded-2xl px-4 py-3 text-left"
                                        onClick={() => pushViewSettings({ filters: option.value })}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span>{option.label}</span>
                                                <span className={cn('text-xs', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                                                    {count}
                                                </span>
                                            </div>
                                            <div className={cn('mt-1 text-xs font-normal', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                                                {option.description}
                                            </div>
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-muted/15 p-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => void commitGradebook(
                                    api.convertCourseGradebookToSolver(courseId, {
                                        revision: gradebook.revision,
                                        assessment_ids: gradebook.assessments.filter((assessment) => assessment.status === 'planned').map((assessment) => assessment.id),
                                    }),
                                    'Converted planned assessments to solver mode.',
                                )}
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Convert Planned to Solver
                            </Button>
                            {selectedScenario ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void commitGradebook(
                                        api.applyCourseGradebookSolvedScore(courseId, {
                                            revision: gradebook.revision,
                                            scenario_id: selectedScenario.id,
                                            assessment_ids: gradebook.assessments
                                                .filter((assessment) => assessment.forecast_mode === 'solver' && assessment.status === 'planned')
                                                .map((assessment) => assessment.id),
                                        }),
                                        `Applied solved scores to ${selectedScenario.name}.`,
                                    )}
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Apply Solver Results
                                </Button>
                            ) : null}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {Array.from(groupedAssessments.entries()).map(([groupName, assessments]) => (
                            <div key={groupName} className="space-y-3">
                                {viewSettings.groupBy === 'type' ? (
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">{groupName}</Badge>
                                        <span className="text-xs text-muted-foreground">{assessments.length} items</span>
                                    </div>
                                ) : null}

                                <div className="overflow-hidden rounded-3xl border border-border/70 bg-background/70">
                                    {assessments.length === 0 ? (
                                        <div className="flex min-h-72 items-center justify-center px-6 text-center text-muted-foreground">
                                            {assessmentSearchQuery || viewSettings.filters !== 'all'
                                                ? 'No assessments match the current search or filter.'
                                                : 'No assessments have been added yet.'}
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <SortableHead
                                                        label="Assessment"
                                                        sortKey="title"
                                                        currentSortKey={viewSettings.sortKey}
                                                        currentDirection={viewSettings.sortDirection}
                                                        onRequestSort={requestSort}
                                                    />
                                                    <SortableHead
                                                        label="Category"
                                                        sortKey="type"
                                                        currentSortKey={viewSettings.sortKey}
                                                        currentDirection={viewSettings.sortDirection}
                                                        onRequestSort={requestSort}
                                                    />
                                                    <SortableHead
                                                        label="Due"
                                                        sortKey="due_date"
                                                        currentSortKey={viewSettings.sortKey}
                                                        currentDirection={viewSettings.sortDirection}
                                                        onRequestSort={requestSort}
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
                                                        label="Status"
                                                        sortKey="status"
                                                        currentSortKey={viewSettings.sortKey}
                                                        currentDirection={viewSettings.sortDirection}
                                                        onRequestSort={requestSort}
                                                    />
                                                    <SortableHead
                                                        label="Score"
                                                        currentSortKey={viewSettings.sortKey}
                                                        currentDirection={viewSettings.sortDirection}
                                                        onRequestSort={requestSort}
                                                        align="right"
                                                    />
                                                    <SortableHead
                                                        label="Edit"
                                                        currentSortKey={viewSettings.sortKey}
                                                        currentDirection={viewSettings.sortDirection}
                                                        onRequestSort={requestSort}
                                                        align="right"
                                                        className="w-[72px]"
                                                    />
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {assessments.map((assessment) => {
                                                    const category = getCategoryById(gradebook.categories, assessment.category_id);
                                                    const displayScore = getAssessmentDisplayScore(assessment, selectedScenario?.id ?? null);
                                                    const overdue = isAssessmentOverdue(assessment);

                                                    return (
                                                        <TableRow key={assessment.id} className="align-top">
                                                            <TableCell className="min-w-[260px]">
                                                                <div className="space-y-1.5">
                                                                    <div className="font-medium text-foreground">{assessment.title}</div>
                                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                        <span>{assessment.forecast_mode === 'solver' ? 'Solver forecast' : 'Manual forecast'}</span>
                                                                        {assessment.notes ? (
                                                                            <>
                                                                                <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                                                                                <span className="line-clamp-1">{assessment.notes}</span>
                                                                            </>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {category ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn('border px-2 py-0 text-[10px]', getCategoryBadgeClassName(category.color_token))}
                                                                    >
                                                                        {category.name}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">Uncategorized</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="space-y-1">
                                                                    <div className={cn('text-sm', overdue ? 'font-medium text-rose-600 dark:text-rose-300' : 'text-foreground')}>
                                                                        {formatGradebookDate(assessment.due_date)}
                                                                    </div>
                                                                    <div className={cn('text-xs', overdue ? 'text-rose-600/90 dark:text-rose-300/90' : 'text-muted-foreground')}>
                                                                        {getRelativeDueText(assessment.due_date)}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {formatPercent(assessment.weight)}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn('border px-2 py-0 text-[10px]', getStatusBadgeClassName(assessment.status))}
                                                                >
                                                                    {getAssessmentStatusLabel(assessment.status)}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="space-y-1">
                                                                    <div className="font-medium tabular-nums text-foreground">
                                                                        {displayScore === null ? 'N/A' : formatPercent(displayScore)}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {assessment.status === 'completed'
                                                                            ? 'Actual score'
                                                                            : assessment.forecast_mode === 'solver'
                                                                                ? 'Solver'
                                                                                : 'Manual'}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    type="button"
                                                                    size="icon-sm"
                                                                    variant="ghost"
                                                                    onClick={() => {
                                                                        setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                                                        setIsAssessmentDialogOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card shadow-none">
                    <Tabs
                        value={viewSettings.activeRailPanel}
                        onValueChange={(value) => pushViewSettings({ activeRailPanel: value as GradebookViewSettings['activeRailPanel'] })}
                        className="h-full"
                    >
                        <CardHeader className="space-y-4">
                            <div>
                                <CardTitle className="text-xl tracking-tight">Focus Rail</CardTitle>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Keep course health, deadlines, and validation feedback visible while planning.
                                </p>
                            </div>
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="summary">Summary</TabsTrigger>
                                <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
                                <TabsTrigger value="validation">Validation</TabsTrigger>
                            </TabsList>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <TabsContent value="summary" className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <PlannerStatCard
                                        label="Actual"
                                        value={formatPercent(gradebook.summary.current_actual_percentage)}
                                        hint={`${formatGpa(gradebook.summary.current_actual_gpa)} GPA`}
                                    />
                                    <PlannerStatCard
                                        label="Projected"
                                        value={formatPercent(gradebook.summary.baseline_projected_percentage)}
                                        hint={`Baseline · ${formatGpa(gradebook.summary.baseline_projected_gpa)} GPA`}
                                    />
                                    <PlannerStatCard
                                        label="Remaining"
                                        value={formatPercent(gradebook.summary.remaining_weight)}
                                        hint="Weight not yet finalized"
                                    />
                                    <PlannerStatCard
                                        label="Required"
                                        value={gradebook.summary.baseline_required_score === null ? 'N/A' : formatPercent(gradebook.summary.baseline_required_score)}
                                        hint="Baseline required course score"
                                    />
                                </div>

                                <Alert className="border-border/70 bg-muted/20">
                                    <Flag className="h-4 w-4" />
                                    <AlertTitle>{getFeasibilityLabel(gradebook.summary.feasibility)}</AlertTitle>
                                    <AlertDescription>
                                        Baseline scenario drives course-level projection cards and widget summaries.
                                    </AlertDescription>
                                </Alert>

                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-foreground">Formula Breakdown</div>
                                    {gradebook.summary.formula_breakdown.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground">
                                            No formula notes available yet.
                                        </div>
                                    ) : gradebook.summary.formula_breakdown.map((line) => (
                                        <div
                                            key={line}
                                            className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground"
                                        >
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="deadlines" className="space-y-3">
                                {gradebook.summary.upcoming_due_items.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                                        No due dates have been assigned yet.
                                    </div>
                                ) : gradebook.summary.upcoming_due_items.map((item) => {
                                    const assessment = gradebook.assessments.find((entry) => entry.id === item.assessment_id);
                                    const overdue = assessment ? isAssessmentOverdue(assessment) : false;
                                    return (
                                        <button
                                            key={item.assessment_id}
                                            type="button"
                                            onClick={() => {
                                                if (!assessment) return;
                                                setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                                setIsAssessmentDialogOpen(true);
                                            }}
                                            className="flex w-full items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-background"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                                                <div className={cn('mt-1 text-xs', overdue ? 'text-rose-600 dark:text-rose-300' : 'text-muted-foreground')}>
                                                    {formatGradebookDate(item.due_date)}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {item.category_name ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn('border px-2 py-0 text-[10px]', getCategoryBadgeClassName(item.category_color_token))}
                                                    >
                                                        {item.category_name}
                                                    </Badge>
                                                ) : null}
                                                {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                                            </div>
                                        </button>
                                    );
                                })}
                            </TabsContent>

                            <TabsContent value="validation" className="space-y-3">
                                {gradebook.summary.validation_issues.length > 0 ? (
                                    gradebook.summary.validation_issues.map((issue) => (
                                        <div
                                            key={issue}
                                            className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                                        >
                                            {issue}
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/5 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-200">
                                        No validation issues detected.
                                    </div>
                                )}

                                <Separator />

                                <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4">
                                    <div className="text-sm font-medium text-foreground">Triage Notes</div>
                                    <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                                        <div>{overdueCount} overdue assessments currently affect planning confidence.</div>
                                        <div>{missingDueDateCount} assessments still need a due date.</div>
                                        <div>{plannedCount} planned assessments remain open in the active scenario.</div>
                                    </div>
                                </div>
                            </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>

            <Card className="border-border/70 bg-card shadow-none">
                <Tabs value={managementTab} onValueChange={(value) => setManagementTab(value as 'scenarios' | 'categories')}>
                    <CardHeader className="space-y-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <CardTitle className="text-xl tracking-tight">Planning Setup</CardTitle>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                                    Scenarios control projection comparisons. Categories keep the assessment list scannable and consistent.
                                </p>
                            </div>
                            <TabsList className="grid w-full max-w-sm grid-cols-2">
                                <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
                                <TabsTrigger value="categories">Categories</TabsTrigger>
                            </TabsList>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <TabsContent value="scenarios" className="space-y-4">
                            <div className="grid gap-3 xl:grid-cols-2">
                                {gradebook.scenarios.map((scenario) => {
                                    const card = gradebook.summary.scenario_cards.find((entry) => entry.scenario_id === scenario.id);
                                    const isSelected = selectedScenario?.id === scenario.id;
                                    return (
                                        <div
                                            key={scenario.id}
                                            className={cn(
                                                'rounded-3xl border px-4 py-4',
                                                isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-background/75',
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-2 min-w-0">
                                                    {editingScenarioId === scenario.id ? (
                                                        <Input
                                                            value={editingScenarioName}
                                                            onChange={(event) => setEditingScenarioName(event.target.value)}
                                                        />
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => pushViewSettings({ selectedScenarioId: scenario.id })}
                                                            className="flex min-w-0 items-center gap-2 text-left"
                                                        >
                                                            <span className={cn('h-2.5 w-2.5 rounded-full', getScenarioSwatchClassName(scenario.color_token))} />
                                                            <span className="truncate text-sm font-semibold text-foreground">{scenario.name}</span>
                                                        </button>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {scenario.is_baseline ? <Badge variant="secondary">Baseline</Badge> : null}
                                                        {isSelected ? <Badge variant="outline">Active in planner</Badge> : null}
                                                        <Badge
                                                            variant="outline"
                                                            className={cn('border px-2 py-0 text-[10px]', getFeasibilityBadgeClassName(card?.feasibility ?? 'invalid'))}
                                                        >
                                                            {getFeasibilityLabel(card?.feasibility ?? 'invalid')}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    {editingScenarioId === scenario.id ? (
                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                void commitGradebook(api.updateCourseGradebookScenario(courseId, scenario.id, {
                                                                    revision: gradebook.revision,
                                                                    name: editingScenarioName.trim(),
                                                                }), 'Scenario updated.');
                                                                setEditingScenarioId(null);
                                                                setEditingScenarioName('');
                                                            }}
                                                        >
                                                            <Save className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                setEditingScenarioId(scenario.id);
                                                                setEditingScenarioName(scenario.name);
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}

                                                    {!scenario.is_baseline ? (
                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() => void commitGradebook(
                                                                api.updateCourseGradebookScenario(courseId, scenario.id, {
                                                                    revision: gradebook.revision,
                                                                    is_baseline: true,
                                                                }),
                                                                'Baseline scenario updated.',
                                                            )}
                                                        >
                                                            <Star className="h-4 w-4" />
                                                        </Button>
                                                    ) : null}

                                                    {gradebook.scenarios.length > 1 ? (
                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => void commitGradebook(
                                                                api.deleteCourseGradebookScenario(courseId, scenario.id, { revision: gradebook.revision }),
                                                                'Scenario deleted.',
                                                            )}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                                <PlannerStatCard
                                                    label="Projected"
                                                    value={formatPercent(card?.projected_percentage)}
                                                    hint={`${formatGpa(card?.projected_gpa)} GPA`}
                                                />
                                                <PlannerStatCard
                                                    label="Required"
                                                    value={card?.required_score === null || card?.required_score === undefined ? 'N/A' : formatPercent(card.required_score)}
                                                    hint="Needed on remaining weight"
                                                />
                                                <PlannerStatCard
                                                    label="Remaining"
                                                    value={formatPercent(card?.remaining_weight)}
                                                    hint="Weight still open"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/15 p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                    <Input
                                        value={newScenarioName}
                                        onChange={(event) => setNewScenarioName(event.target.value)}
                                        placeholder="Expected +5"
                                    />
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            if (!newScenarioName.trim()) return;
                                            void commitGradebook(api.createCourseGradebookScenario(courseId, {
                                                revision: gradebook.revision,
                                                name: newScenarioName.trim(),
                                                color_token: CATEGORY_COLOR_OPTIONS[(gradebook.scenarios.length + 1) % CATEGORY_COLOR_OPTIONS.length].value,
                                            }), 'Scenario created.');
                                            setNewScenarioName('');
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Scenario
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="categories" className="space-y-4">
                            <div className="grid gap-3 xl:grid-cols-2">
                                {gradebook.categories.map((category) => (
                                    <div key={category.id} className="rounded-3xl border border-border/70 bg-background/75 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 space-y-2">
                                                {editingCategoryId === category.id ? (
                                                    <Input
                                                        value={editingCategoryName}
                                                        onChange={(event) => setEditingCategoryName(event.target.value)}
                                                    />
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn('border px-2 py-0 text-[10px]', getCategoryBadgeClassName(category.color_token))}
                                                        >
                                                            {category.name}
                                                        </Badge>
                                                        {category.is_builtin ? <Badge variant="secondary">Builtin</Badge> : null}
                                                        {category.is_archived ? <Badge variant="outline">Archived</Badge> : null}
                                                    </div>
                                                )}
                                                <div className="text-xs text-muted-foreground">
                                                    {category.is_builtin
                                                        ? 'System category used for common gradebook flows.'
                                                        : 'Custom category used for grouping and filtering assessments.'}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {!category.is_builtin ? (
                                                    <>
                                                        {editingCategoryId === category.id ? (
                                                            <Button
                                                                type="button"
                                                                size="icon-sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    void commitGradebook(api.updateCourseGradebookCategory(courseId, category.id, {
                                                                        revision: gradebook.revision,
                                                                        name: editingCategoryName.trim(),
                                                                    }), 'Category updated.');
                                                                    setEditingCategoryId(null);
                                                                    setEditingCategoryName('');
                                                                }}
                                                            >
                                                                <Save className="h-4 w-4" />
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                size="icon-sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setEditingCategoryId(category.id);
                                                                    setEditingCategoryName(category.name);
                                                                }}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}

                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() => void commitGradebook(api.updateCourseGradebookCategory(courseId, category.id, {
                                                                revision: gradebook.revision,
                                                                is_archived: !category.is_archived,
                                                            }), category.is_archived ? 'Category restored.' : 'Category archived.')}
                                                        >
                                                            <Layers3 className="h-4 w-4" />
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => void commitGradebook(
                                                                api.deleteCourseGradebookCategory(courseId, category.id, { revision: gradebook.revision }),
                                                                'Category deleted.',
                                                            )}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/15 p-4">
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                                    <Input
                                        value={newCategoryName}
                                        onChange={(event) => setNewCategoryName(event.target.value)}
                                        placeholder="Create a custom category"
                                    />
                                    <Select value={newCategoryColor} onValueChange={setNewCategoryColor}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Color" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORY_COLOR_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            if (!newCategoryName.trim()) return;
                                            void commitGradebook(api.createCourseGradebookCategory(courseId, {
                                                revision: gradebook.revision,
                                                name: newCategoryName.trim(),
                                                color_token: newCategoryColor,
                                            }), 'Category created.');
                                            setNewCategoryName('');
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Category
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </CardContent>
                </Tabs>
            </Card>

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
    );
};

export const BuiltinGradebookTabDefinition: TabDefinition = {
    type: BUILTIN_GRADEBOOK_TAB_TYPE,
    component: BuiltinGradebookTab,
    defaultSettings: DEFAULT_GRADEBOOK_VIEW_SETTINGS,
};
