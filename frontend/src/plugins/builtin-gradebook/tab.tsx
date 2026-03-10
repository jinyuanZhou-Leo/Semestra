// input:  [course gradebook APIs, course data context refresh helpers, responsive dialog/drawer primitives, and builtin-gradebook shared formatters]
// output: [builtin-gradebook tab component and tab definition]
// pos:    [course-scoped gradebook workspace handling prediction scenarios, category management, assessment editing, and summary insights]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    Flag,
    Layers3,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Sparkles,
    Star,
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { ResponsiveDialogDrawer } from '@/components/ResponsiveDialogDrawer';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    CATEGORY_COLOR_OPTIONS,
    DEFAULT_GRADEBOOK_VIEW_SETTINGS,
    formatGradebookDate,
    formatGradebookDateInput,
    getAssessmentScenarioScore,
    getAssessmentStatusLabel,
    getCategoryBadgeClassName,
    getCategoryById,
    getFeasibilityLabel,
    getScenarioRequiredScore,
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
    notes: string;
    scenario_scores: Record<string, string>;
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
            description="Update type, due date, weight, scores, and notes without leaving the planning table."
            desktopContentClassName="sm:max-w-2xl gap-0"
            mobileContentClassName="max-h-[90vh] gap-0"
            desktopHeaderClassName="border-b px-6 py-5"
            mobileHeaderClassName="border-b px-6 py-5"
            desktopFooterClassName="border-t px-6 py-4"
            mobileFooterClassName="border-t px-6 py-4 flex-row justify-between"
            footer={(
                <div className="flex w-full items-center justify-between gap-3">
                    <div>
                        {onDelete ? (
                            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void onDelete()}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? 'Saving...' : 'Save Assessment'}
                        </Button>
                    </div>
                </div>
            )}
        >
            <div className="space-y-5 px-6 py-5">
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Title</span>
                        <Input value={draft.title} onChange={(event) => setField('title', event.target.value)} placeholder="Final exam" />
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Type</span>
                        <select
                            value={draft.category_id ?? ''}
                            onChange={(event) => setField('category_id', event.target.value || null)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="">No type</option>
                            {categories.filter((category) => !category.is_archived).map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Due Date</span>
                        <Input type="date" value={draft.due_date} onChange={(event) => setField('due_date', event.target.value)} />
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Weight (%)</span>
                        <Input value={draft.weight} inputMode="decimal" onChange={(event) => setField('weight', event.target.value)} placeholder="20" />
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Status</span>
                        <select
                            value={draft.status}
                            onChange={(event) => setField('status', event.target.value as GradebookAssessmentStatus)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="planned">Planned</option>
                            <option value="completed">Completed</option>
                            <option value="excluded">Excluded</option>
                        </select>
                    </label>
                    <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">Forecast Mode</span>
                        <select
                            value={draft.forecast_mode}
                            onChange={(event) => setField('forecast_mode', event.target.value as GradebookForecastMode)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="manual">Manual</option>
                            <option value="solver">Solver</option>
                        </select>
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
                    <div className="text-sm font-medium text-foreground">预测方案 (Scenario) Forecasts</div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {scenarios.map((scenario) => (
                            <label key={scenario.id} className="space-y-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-foreground">{scenario.name}</span>
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
                    <textarea
                        value={draft.notes}
                        onChange={(event) => setField('notes', event.target.value)}
                        className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Optional notes for this assessment"
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
    const [newScenarioName, setNewScenarioName] = React.useState('');
    const [newCategoryName, setNewCategoryName] = React.useState('');
    const [newCategoryColor, setNewCategoryColor] = React.useState<string>(CATEGORY_COLOR_OPTIONS[0].value);
    const [editingScenarioId, setEditingScenarioId] = React.useState<string | null>(null);
    const [editingScenarioName, setEditingScenarioName] = React.useState('');
    const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = React.useState('');

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

    const commitGradebook = React.useCallback(async (promise: Promise<CourseGradebook>, successMessage?: string) => {
        setIsMutating(true);
        try {
            const response = await promise;
            setGradebook(response);
            await refreshCourse();
            if (successMessage) {
                toast.success(successMessage);
            }
        } catch (error: any) {
            console.error('Failed to update gradebook', error);
            if (error?.response?.status === 409) {
                toast.error('Gradebook revision conflict. Reloading latest data.');
                await loadGradebook();
                return;
            }
            toast.error(error?.response?.data?.detail ?? 'Failed to update gradebook.');
        } finally {
            setIsMutating(false);
        }
    }, [loadGradebook, refreshCourse]);

    const selectedScenarioId = gradebook ? getSelectedScenarioId(gradebook, viewSettings) : null;
    const categoriesById = React.useMemo(
        () => new Map((gradebook?.categories ?? []).map((category) => [category.id, category])),
        [gradebook?.categories],
    );

    const filteredAssessments = React.useMemo(() => {
        if (!gradebook) return [];
        const items = [...gradebook.assessments];
        const filtered = items.filter((assessment) => {
            switch (viewSettings.filters) {
                case 'upcoming':
                    return assessment.status === 'planned' && Boolean(assessment.due_date);
                case 'missing_due':
                    return !assessment.due_date;
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
    }, [categoriesById, gradebook, viewSettings.filters, viewSettings.sortDirection, viewSettings.sortKey]);

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
            <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
                <Skeleton className="h-[560px] rounded-3xl" />
                <Skeleton className="h-[560px] rounded-3xl" />
                <Skeleton className="h-[560px] rounded-3xl" />
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
    const selectedScenarioRequiredScore = getScenarioRequiredScore(gradebook, selectedScenario?.id ?? null);

    return (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <div className="space-y-4">
                <Card className="border-border/70 bg-card/80 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base">Target</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant={gradebook.target_mode === 'percentage' ? 'default' : 'outline'}
                                onClick={() => void commitGradebook(
                                    api.updateCourseGradebookTarget(courseId, {
                                        revision: gradebook.revision,
                                        target_mode: 'percentage',
                                        target_value: gradebook.target_mode === 'percentage' ? gradebook.target_value : 85,
                                    }),
                                )}
                                disabled={isMutating}
                            >
                                Percentage
                            </Button>
                            <Button
                                type="button"
                                variant={gradebook.target_mode === 'gpa' ? 'default' : 'outline'}
                                onClick={() => void commitGradebook(
                                    api.updateCourseGradebookTarget(courseId, {
                                        revision: gradebook.revision,
                                        target_mode: 'gpa',
                                        target_value: gradebook.target_mode === 'gpa' ? gradebook.target_value : 4,
                                    }),
                                )}
                                disabled={isMutating}
                            >
                                GPA
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                value={String(gradebook.target_value)}
                                inputMode="decimal"
                                onChange={(event) => {
                                    const next = Number(event.target.value);
                                    if (!Number.isFinite(next)) return;
                                    void commitGradebook(api.updateCourseGradebookTarget(courseId, {
                                        revision: gradebook.revision,
                                        target_mode: gradebook.target_mode as GradebookTargetMode,
                                        target_value: next,
                                    }));
                                }}
                            />
                            <Badge variant="outline">{gradebook.target_mode === 'gpa' ? 'GPA' : '%'}</Badge>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                            Baseline projection: {gradebook.summary.baseline_projected_percentage === null
                                ? 'Unavailable'
                                : `${gradebook.summary.baseline_projected_percentage.toFixed(2)}% · ${gradebook.summary.baseline_projected_gpa?.toFixed(2) ?? '0.00'} GPA`}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/80 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                        <CardTitle className="text-base">预测方案</CardTitle>
                        <Badge variant="secondary">{gradebook.scenarios.length}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            {gradebook.scenarios.map((scenario) => (
                                <div key={scenario.id} className="rounded-2xl border border-border/70 bg-background/85 px-3 py-3">
                                    <div className="flex items-center justify-between gap-2">
                                        {editingScenarioId === scenario.id ? (
                                            <Input
                                                value={editingScenarioName}
                                                onChange={(event) => setEditingScenarioName(event.target.value)}
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => pushViewSettings({ selectedScenarioId: scenario.id })}
                                                className={cn(
                                                    'truncate text-left text-sm font-medium',
                                                    selectedScenario?.id === scenario.id ? 'text-foreground' : 'text-muted-foreground',
                                                )}
                                            >
                                                {scenario.name}
                                            </button>
                                        )}
                                        <div className="flex items-center gap-1">
                                            {scenario.is_baseline ? <Badge variant="secondary">Baseline</Badge> : null}
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
                                                <Button type="button" size="icon-sm" variant="ghost" onClick={() => {
                                                    setEditingScenarioId(scenario.id);
                                                    setEditingScenarioName(scenario.name);
                                                }}>
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
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
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
                                Add
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/80 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                        <CardTitle className="text-base">Category Manager</CardTitle>
                        <Badge variant="secondary">{gradebook.categories.filter((category) => !category.is_archived).length}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {gradebook.categories.map((category) => (
                            <div key={category.id} className="rounded-2xl border border-border/70 bg-background/85 px-3 py-3">
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant="outline" className={cn('border px-2 py-0 text-[10px]', getCategoryBadgeClassName(category.color_token))}>
                                        {category.name}
                                    </Badge>
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
                                                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => {
                                                        setEditingCategoryId(category.id);
                                                        setEditingCategoryName(category.name);
                                                    }}>
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
                                        ) : (
                                            <Badge variant="secondary">Builtin</Badge>
                                        )}
                                    </div>
                                </div>
                                {editingCategoryId === category.id ? (
                                    <div className="mt-2">
                                        <Input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} />
                                    </div>
                                ) : null}
                            </div>
                        ))}
                        <div className="space-y-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-3">
                            <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Create a custom type" />
                            <div className="flex items-center gap-2">
                                <select
                                    value={newCategoryColor}
                                    onChange={(event) => setNewCategoryColor(event.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    {CATEGORY_COLOR_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
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
                                    Add
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <Card className="border-border/70 bg-card/80 shadow-none">
                    <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="text-base">Assessments</CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Types are semantic tags only. Weight, solver mode, and actual scores stay independent.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={viewSettings.filters}
                                onChange={(event) => pushViewSettings({ filters: event.target.value as GradebookViewSettings['filters'] })}
                                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="all">All</option>
                                <option value="upcoming">Upcoming</option>
                                <option value="missing_due">Missing due date</option>
                                <option value="completed">Completed</option>
                                <option value="excluded">Excluded</option>
                            </select>
                            <select
                                value={viewSettings.groupBy}
                                onChange={(event) => pushViewSettings({ groupBy: event.target.value as GradebookViewSettings['groupBy'] })}
                                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="none">No grouping</option>
                                <option value="type">Group by type</option>
                            </select>
                            <select
                                value={viewSettings.sortKey}
                                onChange={(event) => pushViewSettings({ sortKey: event.target.value as GradebookViewSettings['sortKey'] })}
                                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="due_date">Sort by due date</option>
                                <option value="type">Sort by type</option>
                                <option value="weight">Sort by weight</option>
                                <option value="status">Sort by status</option>
                                <option value="title">Sort by title</option>
                            </select>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => pushViewSettings({ sortDirection: viewSettings.sortDirection === 'asc' ? 'desc' : 'asc' })}
                            >
                                {viewSettings.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                            </Button>
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
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
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
                                Convert planned to solver
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
                                        `Applied solved score to ${selectedScenario.name}.`,
                                    )}
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Apply solved score
                                </Button>
                            ) : null}
                        </div>

                        {Array.from(groupedAssessments.entries()).map(([groupName, assessments]) => (
                            <div key={groupName} className="space-y-2">
                                {viewSettings.groupBy === 'type' ? (
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">{groupName}</Badge>
                                        <span className="text-xs text-muted-foreground">{assessments.length} items</span>
                                    </div>
                                ) : null}
                                <div className="overflow-x-auto rounded-2xl border border-border/70">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/25">
                                                <TableHead>Title</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Due</TableHead>
                                                <TableHead className="text-right">Weight</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Mode</TableHead>
                                                <TableHead className="text-right">Actual / Forecast</TableHead>
                                                <TableHead className="text-right">Required</TableHead>
                                                <TableHead className="w-[64px] text-right">Edit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {assessments.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                                                        No assessments match the current filter.
                                                    </TableCell>
                                                </TableRow>
                                            ) : assessments.map((assessment) => {
                                                const category = getCategoryById(gradebook.categories, assessment.category_id);
                                                const displayScore = assessment.status === 'completed'
                                                    ? assessment.actual_score
                                                    : getAssessmentScenarioScore(assessment, selectedScenario?.id ?? null);
                                                return (
                                                    <TableRow key={assessment.id}>
                                                        <TableCell className="min-w-[220px]">
                                                            <div className="font-medium text-foreground">{assessment.title}</div>
                                                            {assessment.notes ? (
                                                                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{assessment.notes}</div>
                                                            ) : null}
                                                        </TableCell>
                                                        <TableCell>
                                                            {category ? (
                                                                <Badge variant="outline" className={cn('border px-2 py-0 text-[10px]', getCategoryBadgeClassName(category.color_token))}>
                                                                    {category.name}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">None</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{formatGradebookDate(assessment.due_date)}</TableCell>
                                                        <TableCell className="text-right tabular-nums">{assessment.weight.toFixed(2)}%</TableCell>
                                                        <TableCell>{getAssessmentStatusLabel(assessment.status)}</TableCell>
                                                        <TableCell className="capitalize">{assessment.forecast_mode}</TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {displayScore === null ? 'N/A' : `${displayScore.toFixed(2)}%`}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {assessment.forecast_mode === 'solver' && assessment.status === 'planned' && selectedScenarioRequiredScore !== null
                                                                ? `${selectedScenarioRequiredScore.toFixed(2)}%`
                                                                : '—'}
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
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <Card className="border-border/70 bg-card/80 shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Flag className="h-4 w-4 text-muted-foreground" />
                            Result Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-2xl border border-border/70 bg-background/85 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Actual</div>
                                <div className="mt-1 text-sm font-semibold text-foreground">
                                    {gradebook.summary.current_actual_percentage === null
                                        ? 'N/A'
                                        : `${gradebook.summary.current_actual_percentage.toFixed(2)}%`}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-background/85 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Remaining</div>
                                <div className="mt-1 text-sm font-semibold text-foreground">{gradebook.summary.remaining_weight.toFixed(2)}%</div>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-background/85 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Projected</div>
                                <div className="mt-1 text-sm font-semibold text-foreground">
                                    {gradebook.summary.baseline_projected_percentage === null
                                        ? 'Unavailable'
                                        : `${gradebook.summary.baseline_projected_percentage.toFixed(2)}%`}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-background/85 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Required</div>
                                <div className="mt-1 text-sm font-semibold text-foreground">
                                    {gradebook.summary.baseline_required_score === null ? 'N/A' : `${gradebook.summary.baseline_required_score.toFixed(2)}%`}
                                </div>
                            </div>
                        </div>
                        <Alert role="alert" className="border-border/70 bg-muted/25">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>{getFeasibilityLabel(gradebook.summary.feasibility)}</AlertTitle>
                            <AlertDescription>
                                Baseline scenario drives the course-wide projected percentage and GPA.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/80 shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            Upcoming Deadlines
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {gradebook.summary.upcoming_due_items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                                No due dates have been assigned yet.
                            </div>
                        ) : gradebook.summary.upcoming_due_items.map((item) => (
                            <button
                                key={item.assessment_id}
                                type="button"
                                onClick={() => {
                                    const assessment = gradebook.assessments.find((entry) => entry.id === item.assessment_id);
                                    if (!assessment) return;
                                    setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                    setIsAssessmentDialogOpen(true);
                                }}
                                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/85 px-3 py-3 text-left transition hover:bg-accent/40"
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{formatGradebookDate(item.due_date)}</div>
                                </div>
                                {item.category_name ? (
                                    <Badge variant="outline" className={cn('border px-2 py-0 text-[10px]', getCategoryBadgeClassName(item.category_color_token))}>
                                        {item.category_name}
                                    </Badge>
                                ) : null}
                            </button>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/80 shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            Validation & Formula
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {gradebook.summary.validation_issues.length > 0 ? (
                            <div className="space-y-2">
                                {gradebook.summary.validation_issues.map((issue) => (
                                    <div key={issue} className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                                        {issue}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/5 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                                No validation issues detected.
                            </div>
                        )}
                        <div className="space-y-2">
                            {gradebook.summary.formula_breakdown.map((line) => (
                                <div key={line} className="rounded-2xl border border-border/70 bg-background/85 px-3 py-3 text-sm text-muted-foreground">
                                    {line}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

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
