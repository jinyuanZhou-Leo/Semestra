// input:  [course gradebook APIs, Course/Semester data contexts, LMS assignment APIs, plugin UI-state hooks, shared timetable refresh bus, animated stat-strip UI, shadcn UI/scroll-area primitives, switch/dialog primitives, builtin-gradebook shared forecast/plan helpers plus GPA-threshold resolution helpers, and shared business empty-state wrappers]
// output: [course- and semester-scoped builtin-gradebook tab component plus tab definition]
// pos:    [Gradebook tab runtime that keeps Course assessment scoring local while deriving Semester course-row GPA and What If planning from host-provided Semester courses]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowRightLeft, CalendarDays, FlaskConical, GraduationCap, Pencil, Percent, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AppEmptyState } from '@/components/AppEmptyState';
import { DataTable, DataTableActionMenu, type ColumnDef } from '@/components/DataTable';
import api, {
    type Course,
    type CourseGradebook,
    type GradebookAssessment,
    type GradebookScalingTable,
} from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import type { TabDefinition, TabProps } from '@/plugin-system';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { useCourseData } from '@/contexts/CourseDataContext';
import { useSemesterData } from '@/contexts/SemesterDataContext';
import { useCourseGradebookMutation, useCourseGradebookQuery } from '@/hooks/useCourseGradebookQuery';
import { usePluginUiState } from '@/plugin-system';
import { DEFAULT_GPA_SCALING_TABLE_JSON } from '@/utils/gpaUtils';
import { getCourseBadgeStyle, getCourseCategoryBadgeClassName, parseSubjectColorMap, resolveCourseColor } from '@/utils/courseCategoryBadge';
import { publishTimetableScheduleChange } from '../builtin-event-core/shared/publishTimetableScheduleChange';
import { AssessmentDialog, createAssessmentDraft, type AssessmentDraft } from './components/AssessmentDialog';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    buildComputedGradebookSummary,
    buildPlanModeResult,
    buildSemesterGradebookPlanResult,
    buildSemesterGradebookSummary,
    buildSuggestedWhatIfScores,
    calculateGradebookGpa,
    hasCompleteGradebookWeight,
    formatGradebookDate,
    formatGradebookDateInput,
    formatGradebookGpaPercentage,
    formatPercent,
    getApiErrorMessage,
    getCategoryBadgeClassName,
    getCategoryBadgeStyle,
    getCategoryById,
    getRelativeDueText,
    isAssessmentOverdue,
    resolveTargetPercentageForGpa,
} from './shared';
type TargetInputMode = 'gpa' | 'percentage';

interface ParsedTargetDraftValue {
    targetGpa: number;
    targetPercentage: number | null;
}

interface GradebookPlanModeUiState {
    planMode: boolean;
    whatIfDrafts: Record<string, string>;
    targetInputMode: TargetInputMode;
}

const publishGradebookAssessmentCalendarRefresh = async (courseId: string, semesterId?: string) => {
    await publishTimetableScheduleChange({
        source: 'course',
        reason: 'gradebook-assessments-updated',
        courseId,
        semesterId,
    });
};

const parseOptionalNumber = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseDraftDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
};

const isBoundedPercentageInput = (value: string) => {
    if (!value.trim()) return true;
    if (!/^\d*\.?\d*$/.test(value)) return false;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
};

const getGradebookAssessmentFingerprint = (assessment: Pick<GradebookAssessment, 'title' | 'due_date'>) => {
    return `${assessment.title.trim().toLowerCase()}::${assessment.due_date ?? ''}`;
};

const formatTargetDraftValue = (
    gradebook: CourseGradebook,
    inputMode: TargetInputMode,
    targetGpa: number = gradebook.target_gpa,
) => {
    if (inputMode === 'percentage') {
        const targetPercentage = resolveTargetPercentageForGpa(targetGpa, gradebook.scaling_table);
        return targetPercentage === null ? '' : String(targetPercentage);
    }
    return String(targetGpa);
};

const parseTargetDraftValue = (
    gradebook: CourseGradebook,
    draftValue: string,
    inputMode: TargetInputMode,
) : ParsedTargetDraftValue | null => {
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) return null;
    if (inputMode === 'percentage') {
        if (parsed < 0 || parsed > 100) return null;
        return {
            targetGpa: calculateGradebookGpa(parsed, gradebook.scaling_table) ?? 0,
            targetPercentage: parsed,
        };
    }
    return {
        targetGpa: parsed,
        targetPercentage: resolveTargetPercentageForGpa(parsed, gradebook.scaling_table),
    };
};

const CourseGradebookTab: React.FC<TabProps> = ({ courseId }) => {
    const { course, updateCourse } = useCourseData();
    const {
        state: planModeState,
        setState: setPlanModeUiState,
    } = usePluginUiState<GradebookPlanModeUiState>('gradebook-plan-mode', () => ({
        planMode: false,
        whatIfDrafts: {},
        targetInputMode: 'gpa',
    }));
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [isMutating, setIsMutating] = React.useState(false);
    const [assessmentDraft, setAssessmentDraft] = React.useState<AssessmentDraft | null>(null);
    const [assessmentDialogOpen, setAssessmentDialogOpen] = React.useState(false);
    const [pendingDeleteAssessment, setPendingDeleteAssessment] = React.useState<GradebookAssessment | null>(null);
    const [scoreDrafts, setScoreDrafts] = React.useState<Record<string, string>>({});
    const [weightDrafts, setWeightDrafts] = React.useState<Record<string, string>>({});
    const [dueDateDrafts, setDueDateDrafts] = React.useState<Record<string, string>>({});
    const [editingWeightAssessmentId, setEditingWeightAssessmentId] = React.useState<string | null>(null);
    const [editingDueDateAssessmentId, setEditingDueDateAssessmentId] = React.useState<string | null>(null);
    const [planModeIntroOpen, setPlanModeIntroOpen] = React.useState(false);
    const [planModeExitOpen, setPlanModeExitOpen] = React.useState(false);
    const [targetGpaDraft, setTargetGpaDraft] = React.useState('');
    const gradebookQuery = useCourseGradebookQuery(courseId);
    const gradebookMutation = useCourseGradebookMutation(courseId);
    const gradebook = gradebookQuery.data ?? null;
    const lmsLinkQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsLink(courseId) : ['courses', 'lms-link', 'disabled'],
        queryFn: () => api.getCourseLmsLink(courseId!),
        enabled: Boolean(courseId),
        retry: false,
        staleTime: 60_000,
    });
    const lmsAssignmentsQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsAssignments(courseId) : ['courses', 'lms-assignments', 'disabled'],
        queryFn: () => api.getCourseLmsAssignments(courseId!),
        enabled: Boolean(courseId && lmsLinkQuery.data),
        retry: false,
        staleTime: 60_000,
    });
    const importedLmsAssignmentFingerprints = React.useMemo(() => (
        new Set(
            gradebook?.assessments.map((assessment) => getGradebookAssessmentFingerprint(assessment)) ?? [],
        )
    ), [gradebook?.assessments]);
    const planMode = planModeState.planMode;
    const whatIfDrafts = planModeState.whatIfDrafts;
    const targetInputMode = planModeState.targetInputMode;

    const updatePlanModeState = React.useCallback((patch: Partial<GradebookPlanModeUiState>) => {
        setPlanModeUiState((currentState) => ({
            ...currentState,
            ...patch,
        }));
    }, [setPlanModeUiState]);

    React.useEffect(() => {
        if (gradebookQuery.error) {
            console.error('Failed to load gradebook tab', gradebookQuery.error);
            setErrorMessage('Failed to load the course gradebook.');
            return;
        }
        setErrorMessage(null);
    }, [gradebookQuery.error]);

    React.useEffect(() => {
        if (!gradebook) return;
        setTargetGpaDraft((currentValue) => {
            if (targetInputMode === 'percentage' && currentValue.trim()) {
                return currentValue;
            }
            return formatTargetDraftValue(gradebook, targetInputMode);
        });
        setScoreDrafts(Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                assessment.score === null || assessment.score === undefined ? '' : String(assessment.score),
            ]),
        ));
        setWeightDrafts(Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                String(assessment.weight),
            ]),
        ));
        setDueDateDrafts(Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                formatGradebookDateInput(assessment.due_date),
            ]),
        ));
    }, [gradebook, targetInputMode]);

    React.useEffect(() => {
        if (!gradebook) {
            return;
        }
        const editableAssessmentIds = new Set(
            gradebook.assessments
                .filter((assessment) => assessment.score === null)
                .map((assessment) => assessment.id),
        );
        setPlanModeUiState((currentState) => {
            const nextWhatIfDrafts = Object.fromEntries(
                Object.entries(currentState.whatIfDrafts).filter(([assessmentId]) => editableAssessmentIds.has(assessmentId)),
            );
            const shouldResetPlanMode = currentState.planMode && !hasCompleteGradebookWeight(gradebook);
            const planModeStateChanged = shouldResetPlanMode
                || Object.keys(nextWhatIfDrafts).length !== Object.keys(currentState.whatIfDrafts).length;
            if (!planModeStateChanged) {
                return currentState;
            }
            return {
                planMode: shouldResetPlanMode ? false : currentState.planMode,
                whatIfDrafts: nextWhatIfDrafts,
                targetInputMode: currentState.targetInputMode,
            };
        });
    }, [gradebook, setPlanModeUiState]);

    const commitGradebook = React.useCallback(async (promise: Promise<CourseGradebook>) => {
        setIsMutating(true);
        try {
            const response = await gradebookMutation.mutateAsync(() => promise);
            const nextSummary = buildComputedGradebookSummary(response);
            if (nextSummary.current_real_percentage !== null && nextSummary.current_real_gpa !== null) {
                updateCourse({
                    grade_percentage: nextSummary.current_real_percentage,
                    grade_scaled: nextSummary.current_real_gpa,
                });
            }
            return true;
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            toast.error(getApiErrorMessage(error));
            return false;
        } finally {
            setIsMutating(false);
        }
    }, [gradebookMutation, updateCourse]);

    const categoriesById = React.useMemo(
        () => new Map((gradebook?.categories ?? []).map((category) => [category.id, category])),
        [gradebook?.categories],
    );
    const summary = React.useMemo(
        () => (gradebook ? buildComputedGradebookSummary(gradebook) : null),
        [gradebook],
    );
    const hasCompleteWeight = summary?.has_complete_weight ?? false;

    const parsedWhatIfScores = React.useMemo(
        () => Object.fromEntries(
            Object.entries(whatIfDrafts)
                .map(([assessmentId, value]) => [assessmentId, parseOptionalNumber(value)])
                .filter((entry): entry is [string, number] => entry[1] !== null),
        ),
        [whatIfDrafts],
    );

    // Derive what-if projected values for the stat strip (never persisted).
    // Must live before any early returns to satisfy the Rules of Hooks.
    const whatIfResult = React.useMemo(() => {
        if (!gradebook || !planMode || Object.keys(parsedWhatIfScores).length === 0) return null;
        if (!hasCompleteGradebookWeight(gradebook)) return null;
        const parsed = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode);
        if (parsed === null) return null;
        return buildPlanModeResult(gradebook, parsed.targetGpa, parsed.targetPercentage, parsedWhatIfScores);
    }, [gradebook, parsedWhatIfScores, planMode, targetGpaDraft, targetInputMode]);

    const enterPlanMode = React.useCallback(() => {
        if (!hasCompleteWeight) {
            toast.error('Weights must total 100%.');
            return;
        }
        updatePlanModeState({ planMode: true });
        setPlanModeIntroOpen(false);
    }, [hasCompleteWeight, updatePlanModeState]);

    const exitPlanMode = React.useCallback(() => {
        updatePlanModeState({
            planMode: false,
            whatIfDrafts: {},
        });
        setPlanModeExitOpen(false);
    }, [updatePlanModeState]);

    const handlePlanModeCheckedChange = React.useCallback((checked: boolean) => {
        if (checked) {
            setPlanModeIntroOpen(true);
            return;
        }
        setPlanModeExitOpen(true);
    }, []);

    const handleSaveAssessment = async () => {
        if (!courseId || !assessmentDraft) return;
        if (!assessmentDraft.id && assessmentDraft.source_mode === 'lms') {
            if (assessmentDraft.selected_lms_assignment_ids.length === 0) {
                toast.error('Select at least one LMS assignment to add.');
                return;
            }
            setIsMutating(true);
            try {
                const selectedAssignments = (lmsAssignmentsQuery.data?.items ?? [])
                    .filter((assignment) => assessmentDraft.selected_lms_assignment_ids.includes(assignment.external_id));
                let latestGradebook: CourseGradebook | null = null;
                for (const assignment of selectedAssignments) {
                    latestGradebook = await api.createCourseGradebookAssessment(courseId, {
                        category_id: assessmentDraft.category_id,
                        title: assignment.title,
                        due_date: assignment.due_date ?? null,
                        weight: 0,
                        score: null,
                        points_earned: null,
                        points_possible: null,
                    });
                }
                if (!latestGradebook) {
                    toast.error('No LMS assignments were selected.');
                    return;
                }
                await gradebookMutation.mutateAsync(() => Promise.resolve(latestGradebook));
                const nextSummary = buildComputedGradebookSummary(latestGradebook);
                if (nextSummary.current_real_percentage !== null && nextSummary.current_real_gpa !== null) {
                    updateCourse({
                        grade_percentage: nextSummary.current_real_percentage,
                        grade_scaled: nextSummary.current_real_gpa,
                    });
                }
                publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
                toast.success(`Added ${selectedAssignments.length} LMS assessment${selectedAssignments.length === 1 ? '' : 's'} to Gradebook.`);
                setAssessmentDialogOpen(false);
                setAssessmentDraft(null);
            } catch (error: unknown) {
                console.error('Failed to add LMS assignments to gradebook', error);
                toast.error(getApiErrorMessage(error));
            } finally {
                setIsMutating(false);
            }
            return;
        }

        const payload = {
            category_id: assessmentDraft.category_id,
            title: assessmentDraft.title.trim(),
            due_date: assessmentDraft.due_date || null,
            weight: Number(assessmentDraft.weight) || 0,
            score: assessmentDraft.score_mode === 'percent' ? parseOptionalNumber(assessmentDraft.score) : null,
            points_earned: assessmentDraft.score_mode === 'points' ? parseOptionalNumber(assessmentDraft.points_earned) : null,
            points_possible: assessmentDraft.score_mode === 'points' ? parseOptionalNumber(assessmentDraft.points_possible) : null,
        };

        if (!payload.title) {
            toast.error('Assessment title is required.');
            return;
        }
        if (assessmentDraft.score_mode === 'points') {
            const hasEitherPoints = payload.points_earned !== null || payload.points_possible !== null;
            if (hasEitherPoints && (payload.points_earned === null || payload.points_possible === null)) {
                toast.error('Enter both points earned and points possible.');
                return;
            }
            if (payload.points_possible !== null && payload.points_possible <= 0) {
                toast.error('Points possible must be greater than 0.');
                return;
            }
        }

        const didSave = assessmentDraft.id
            ? await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessmentDraft.id, payload))
            : await commitGradebook(api.createCourseGradebookAssessment(courseId, payload));
        if (!didSave) {
            return;
        }
        publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);

        setAssessmentDialogOpen(false);
        setAssessmentDraft(null);
    };

    const handlePersistTargetGpa = React.useCallback(async () => {
        if (!courseId || !gradebook) return;
        if (!targetGpaDraft.trim()) {
            return;
        }
        const parsed = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode);
        if (parsed === null) {
            toast.error(targetInputMode === 'percentage' ? 'Enter a valid GPA percentage target.' : 'Enter a valid GPA target.');
            setTargetGpaDraft(formatTargetDraftValue(gradebook, targetInputMode));
            return;
        }
        if (parsed.targetGpa === gradebook.target_gpa) return;
        await commitGradebook(api.updateCourseGradebookPreferences(courseId, { target_gpa: parsed.targetGpa }));
    }, [commitGradebook, courseId, gradebook, targetGpaDraft, targetInputMode]);

    const handleRunPlan = React.useCallback(async () => {
        if (!gradebook) return;
        if (!hasCompleteGradebookWeight(gradebook)) {
            toast.error('Weights must total 100%.');
            return;
        }
        if (!targetGpaDraft.trim()) {
            toast.error(targetInputMode === 'percentage'
                ? 'Enter a GPA percentage target before running Auto-fill.'
                : 'Enter a GPA target before running Auto-fill.');
            return;
        }
        const parsed = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode);
        if (parsed === null) {
            toast.error(targetInputMode === 'percentage'
                ? 'Enter a valid GPA percentage target before running the plan.'
                : 'Enter a valid GPA target before running the plan.');
            return;
        }
        const suggestions = buildSuggestedWhatIfScores(gradebook, parsed.targetPercentage);
        updatePlanModeState({
            whatIfDrafts: Object.fromEntries(
                Object.entries(suggestions).map(([assessmentId, score]) => [assessmentId, String(score)]),
            ),
        });
        await handlePersistTargetGpa();
    }, [gradebook, handlePersistTargetGpa, targetGpaDraft, targetInputMode, updatePlanModeState]);

    const handleToggleTargetInputMode = React.useCallback(() => {
        if (!gradebook) return;
        const nextInputMode: TargetInputMode = targetInputMode === 'gpa' ? 'percentage' : 'gpa';
        const parsedTargetGpa = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode)?.targetGpa ?? gradebook.target_gpa;
        updatePlanModeState({ targetInputMode: nextInputMode });
        setTargetGpaDraft(formatTargetDraftValue(gradebook, nextInputMode, parsedTargetGpa));
    }, [gradebook, targetGpaDraft, targetInputMode, updatePlanModeState]);

    const handleSaveScore = React.useCallback(async (assessment: GradebookAssessment) => {
        if (!courseId || planMode) return;
        const nextValue = parseOptionalNumber(scoreDrafts[assessment.id] ?? '');
        if (nextValue !== null && (nextValue < 0 || nextValue > 100)) {
            setScoreDrafts((current) => ({
                ...current,
                [assessment.id]: assessment.score === null || assessment.score === undefined ? '' : String(assessment.score),
            }));
            toast.error('Score must stay between 0 and 100.');
            return;
        }
        if (nextValue === assessment.score) return;
        await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            score: nextValue,
            points_earned: null,
            points_possible: null,
        }));
    }, [commitGradebook, courseId, planMode, scoreDrafts]);

    const handleSaveWeight = React.useCallback(async (assessment: GradebookAssessment) => {
        if (!courseId || planMode) return;
        const rawValue = weightDrafts[assessment.id] ?? '';
        const parsedWeight = rawValue.trim() ? Number(rawValue) : 0;
        if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 100) {
            setWeightDrafts((current) => ({
                ...current,
                [assessment.id]: String(assessment.weight),
            }));
            toast.error('Weight must stay between 0 and 100.');
            return;
        }
        setEditingWeightAssessmentId(null);
        if (parsedWeight === assessment.weight) return;
        await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            weight: parsedWeight,
        }));
    }, [commitGradebook, courseId, planMode, weightDrafts]);

    const handleSaveDueDate = React.useCallback(async (assessment: GradebookAssessment, nextDueDate: string) => {
        if (!courseId || planMode) return;
        setDueDateDrafts((current) => ({
            ...current,
            [assessment.id]: nextDueDate,
        }));
        setEditingDueDateAssessmentId(null);
        const normalizedDueDate = nextDueDate || '';
        const currentDueDate = formatGradebookDateInput(assessment.due_date);
        if (normalizedDueDate === currentDueDate) {
            return;
        }
        const didSave = await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            due_date: normalizedDueDate || null,
        }));
        if (!didSave) {
            setDueDateDrafts((current) => ({
                ...current,
                [assessment.id]: currentDueDate,
            }));
            return;
        }
        publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
    }, [commitGradebook, course?.semester_id, courseId, planMode]);

    const canManageAssessments = !planMode;
    const assessmentColumns: ColumnDef<GradebookAssessment>[] = !gradebook ? [] : [
            {
                key: 'title',
                label: 'Assessment',
                fit: 'fill',
                minWidth: 220,
                sortable: (left, right) => left.title.localeCompare(right.title),
                cellClassName: 'py-3',
                truncateCell: true,
                cell: (assessment) => (
                    <div className="min-w-0 truncate font-medium text-foreground" title={assessment.title}>
                        {assessment.title}
                    </div>
                ),
            },
            {
                key: 'category',
                label: 'Category',
                width: 132,
                sortable: (left, right) => {
                    const leftName = categoriesById.get(left.category_id ?? '')?.name ?? '';
                    const rightName = categoriesById.get(right.category_id ?? '')?.name ?? '';
                    return leftName.localeCompare(rightName);
                },
                cellClassName: 'py-3',
                cell: (assessment) => {
                    const category = getCategoryById(gradebook.categories, assessment.category_id);
                    return category ? (
                        <Badge
                            variant="outline"
                            className={cn('max-w-full select-none truncate border-0 px-2.5 py-0.5 text-xs font-medium', getCategoryBadgeClassName(category.color_token))}
                            style={getCategoryBadgeStyle(category.color_token)}
                            title={category.name}
                        >
                            {category.name}
                        </Badge>
                    ) : (
                        <span className="text-xs text-muted-foreground/60">Uncategorized</span>
                    );
                },
            },
            {
                key: 'due_date',
                label: 'Due',
                width: 156,
                sortable: (left, right) => (left.due_date ?? '9999-12-31').localeCompare(right.due_date ?? '9999-12-31'),
                cellClassName: 'py-3',
                cell: (assessment) => {
                    const dueDateValue = dueDateDrafts[assessment.id] ?? formatGradebookDateInput(assessment.due_date);
                    const dueDate = parseDraftDate(dueDateValue);
                    const overdue = assessment.due_date ? isAssessmentOverdue({
                        ...assessment,
                        due_date: dueDateValue || null,
                    }) : false;
                    return (
                        <Popover
                            open={editingDueDateAssessmentId === assessment.id}
                            onOpenChange={(open) => {
                                setEditingDueDateAssessmentId(open ? assessment.id : null);
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-auto w-full justify-start px-0 py-0 text-left hover:bg-transparent"
                                    disabled={!canManageAssessments}
                                >
                                    <div className="flex min-h-8 w-full items-center">
                                        {dueDateValue ? (
                                            <div className="min-w-0 space-y-0.5">
                                                <div className={cn('text-sm', overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                                                    {formatGradebookDate(dueDateValue)}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">{getRelativeDueText(dueDateValue)}</div>
                                            </div>
                                        ) : (
                                            <div className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground/60">
                                                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                                <span>No due date</span>
                                            </div>
                                        )}
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    autoFocus
                                    mode="single"
                                    selected={dueDate}
                                    onSelect={(date) => {
                                        void handleSaveDueDate(
                                            assessment,
                                            date ? format(date, 'yyyy-MM-dd') : '',
                                        );
                                    }}
                                />
                                {dueDateValue ? (
                                    <div className="flex justify-end border-t px-3 py-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                void handleSaveDueDate(assessment, '');
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                ) : null}
                            </PopoverContent>
                        </Popover>
                    );
                },
            },
            {
                key: 'weight',
                label: 'Weight',
                width: 96,
                align: 'right',
                sortable: (left, right) => left.weight - right.weight,
                cellClassName: 'py-3',
                cell: (assessment) => (
                    <div className="flex justify-end">
                        {editingWeightAssessmentId === assessment.id ? (
                            <Input
                                autoFocus
                                className="ml-auto h-8 w-24 text-right tabular-nums focus-visible:bg-background"
                                inputMode="decimal"
                                value={weightDrafts[assessment.id] ?? ''}
                                disabled={!canManageAssessments || isMutating}
                                onFocus={(event) => event.currentTarget.select()}
                                onChange={(event) => {
                                    const nextValue = event.target.value;
                                    if (!isBoundedPercentageInput(nextValue)) {
                                        return;
                                    }
                                    setWeightDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                                }}
                                onBlur={() => {
                                    void handleSaveWeight(assessment);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void handleSaveWeight(assessment);
                                    }
                                    if (event.key === 'Escape') {
                                        setWeightDrafts((current) => ({
                                            ...current,
                                            [assessment.id]: String(assessment.weight),
                                        }));
                                        setEditingWeightAssessmentId(null);
                                    }
                                }}
                            />
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                className="ml-auto h-auto px-0 py-0 text-right tabular-nums hover:bg-transparent"
                                disabled={!canManageAssessments}
                                onClick={() => setEditingWeightAssessmentId(assessment.id)}
                            >
                                {formatPercent(assessment.weight)}
                            </Button>
                        )}
                    </div>
                ),
            },
            {
                key: 'score',
                label: planMode ? 'What If' : 'Score',
                width: 112,
                align: 'right',
                sortable: (left, right) => (left.score ?? -1) - (right.score ?? -1),
                cellClassName: 'py-3',
                cell: (assessment) => {
                    const isRealOnly = assessment.score !== null;
                    return (
                        <Input
                            className={cn(
                                'ml-auto h-8 w-24 text-right tabular-nums focus-visible:bg-background',
                                planMode
                                    ? isRealOnly
                                        ? 'border-border/60 bg-muted/30 text-muted-foreground'
                                        : 'border-amber-400/80 bg-amber-50/80 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/20 dark:text-amber-50'
                                    : 'border-border/60 bg-muted/20',
                            )}
                            value={planMode
                                ? isRealOnly
                                    ? (scoreDrafts[assessment.id] ?? '')
                                    : (whatIfDrafts[assessment.id] ?? '')
                                : (scoreDrafts[assessment.id] ?? '')}
                            inputMode="decimal"
                            disabled={isMutating || (planMode && isRealOnly)}
                            placeholder={planMode ? 'What if' : '--'}
                            onChange={(event) => {
                                const nextValue = event.target.value;
                                if (planMode) {
                                    setPlanModeUiState((currentState) => ({
                                        ...currentState,
                                        whatIfDrafts: {
                                            ...currentState.whatIfDrafts,
                                            [assessment.id]: nextValue,
                                        },
                                    }));
                                    return;
                                }
                                if (!isBoundedPercentageInput(nextValue)) {
                                    return;
                                }
                                setScoreDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                            }}
                            onBlur={() => {
                                if (!planMode) {
                                    void handleSaveScore(assessment);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !planMode) {
                                    event.preventDefault();
                                    void handleSaveScore(assessment);
                                }
                            }}
                        />
                    );
                },
            },
            {
                key: 'actions',
                label: 'Actions',
                width: 88,
                align: 'right',
                cell: (assessment) => (
                    <DataTableActionMenu
                        triggerLabel={`Open actions for ${assessment.title}`}
                        disabled={!canManageAssessments}
                    >
                        <DropdownMenuItem
                            disabled={!canManageAssessments}
                            onClick={() => {
                                setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                setAssessmentDialogOpen(true);
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            disabled={!canManageAssessments}
                            onClick={() => setPendingDeleteAssessment(assessment)}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DataTableActionMenu>
                    ),
            },
        ];

    if (!courseId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Gradebook unavailable"
                description="This tab requires a course context."
            />
        );
    }

    if (gradebookQuery.isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-44 w-full rounded-2xl" />
                <Skeleton className="h-[520px] w-full rounded-2xl" />
            </div>
        );
    }

    if (!gradebook || errorMessage || !summary) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Gradebook failed to load"
                description={errorMessage ?? 'Unknown error.'}
                primaryAction={(
                    <Button type="button" onClick={() => void gradebookQuery.refetch()}>
                        Retry
                    </Button>
                )}
            />
        );
    }
    const showWeightMismatchState = Boolean(course && summary && !summary.has_complete_weight);

    return (
        <div className="space-y-4">
            {course ? (
                <section className="mb-2.5">
                    <div className={cn(
                        'grid select-none rounded-lg border overflow-hidden transition-colors duration-300',
                        showWeightMismatchState
                            ? 'border-rose-300/80 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-950/15'
                            : planMode
                            ? 'border-amber-300/60 dark:border-amber-500/30'
                            : 'border-border/70',
                    )} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        {/* Grade */}
                        <div className={cn(
                            'min-w-0 px-3.5 py-2.5 transition-colors duration-300',
                            showWeightMismatchState
                                ? 'bg-rose-50/80 dark:bg-rose-950/20'
                                : planMode ? 'bg-amber-50/60 dark:bg-amber-950/25' : '',
                        )}>
                            <div className="flex items-center gap-1.5">
                                {showWeightMismatchState
                                    ? <Percent className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                                    : planMode
                                    ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                                    : <Percent className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                                <p className={cn(
                                    'truncate text-xs font-medium transition-colors duration-300',
                                    showWeightMismatchState
                                        ? 'text-rose-700 dark:text-rose-300'
                                        : planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                                )}>
                                    {planMode ? 'Grade · What If' : 'Grade'}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                                {showWeightMismatchState ? (
                                    <span className="text-rose-600 dark:text-rose-400">N/A</span>
                                ) : (
                                    <span className={planMode ? 'text-amber-600 dark:text-amber-400' : undefined}>
                                        <AnimatedNumber
                                            value={planMode && whatIfResult ? whatIfResult.projected_percentage : course.grade_percentage}
                                            format={formatGradebookGpaPercentage}
                                        />
                                    </span>
                                )}
                            </div>
                            {showWeightMismatchState ? (
                                <p className="mt-1 text-[11px] text-rose-700/90 dark:text-rose-300/90">
                                    Weight {summary.total_weight.toFixed(1)}%. Need 100%.
                                </p>
                            ) : null}
                        </div>

                        {/* GPA */}
                        <div className={cn(
                            'min-w-0 border-l px-3.5 py-2.5 transition-colors duration-300',
                            showWeightMismatchState
                                ? 'border-rose-300/80 bg-rose-50/80 dark:border-rose-500/40 dark:bg-rose-950/20'
                                : planMode
                                ? 'border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/25'
                                : 'border-border/70',
                        )}>
                            <div className="flex items-center gap-1.5">
                                {showWeightMismatchState
                                    ? <GraduationCap className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                                    : planMode
                                    ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                                    : <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                                <p className={cn(
                                    'truncate text-xs font-medium transition-colors duration-300',
                                    showWeightMismatchState
                                        ? 'text-rose-700 dark:text-rose-300'
                                        : planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                                )}>
                                    {planMode ? 'GPA · What If' : 'GPA'}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                                {showWeightMismatchState ? (
                                    <span className="text-rose-600 dark:text-rose-400">N/A</span>
                                ) : (
                                    <span className={planMode ? 'text-amber-600 dark:text-amber-400' : undefined}>
                                        <AnimatedNumber
                                            value={planMode && whatIfResult ? whatIfResult.projected_gpa : course.grade_scaled}
                                            format={(v) => v.toFixed(2)}
                                            rainbowThreshold={planMode ? undefined : 3.8}
                                        />
                                    </span>
                                )}
                            </div>
                            {showWeightMismatchState ? (
                                <p className="mt-1 text-[11px] text-rose-700/90 dark:text-rose-300/90">
                                    Set weights to 100%.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">Assessments</h2>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex h-11 w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                            <Label htmlFor="gradebook-plan-mode" className="flex items-center gap-2 text-sm font-medium tracking-tight">
                                <Sparkles className={cn('h-4 w-4', planMode ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground')} />
                                <span>Plan Mode</span>
                            </Label>
                            <Switch
                                id="gradebook-plan-mode"
                                checked={planMode}
                                onCheckedChange={handlePlanModeCheckedChange}
                                disabled={isMutating}
                                className="data-checked:bg-amber-500 data-unchecked:bg-slate-300/80 dark:data-unchecked:bg-slate-700"
                                aria-label="Toggle Plan Mode"
                            />
                        </div>

                        {planMode ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <Target className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                                <Label htmlFor="gradebook-target-gpa" className="shrink-0 text-sm font-medium whitespace-nowrap">
                                    Target
                                </Label>
                                <InputGroup className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                                    <InputGroupInput
                                        id="gradebook-target-gpa"
                                        aria-label={targetInputMode === 'gpa' ? 'Target GPA' : 'Target %'}
                                        className="tabular-nums"
                                        value={targetGpaDraft}
                                        inputMode="decimal"
                                        placeholder={targetInputMode === 'gpa' ? '3.70' : '85.0'}
                                        onChange={(event) => setTargetGpaDraft(event.target.value)}
                                        onBlur={() => void handlePersistTargetGpa()}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                void handlePersistTargetGpa();
                                            }
                                        }}
                                    />
                                    <InputGroupAddon align="inline-end">
                                        <InputGroupText>{targetInputMode === 'gpa' ? 'GPA' : '%'}</InputGroupText>
                                    </InputGroupAddon>
                                </InputGroup>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="shrink-0"
                                    onClick={handleToggleTargetInputMode}
                                    aria-label={targetInputMode === 'gpa' ? 'Switch target input to GPA Percentage' : 'Switch target input to GPA'}
                                    title={targetInputMode === 'gpa' ? 'Switch to GPA Percentage' : 'Switch to GPA'}
                                >
                                    <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                                    <span>{targetInputMode === 'gpa' ? 'Use %' : 'Use GPA'}</span>
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    <div className="w-full shrink-0 sm:w-auto">
                        <div className="relative w-full sm:w-[184px]">
                            <div
                                className={cn(
                                    'transition-all duration-200',
                                    planMode ? 'pointer-events-none invisible opacity-0' : 'opacity-100',
                                )}
                            >
                                <Button
                                    type="button"
                                    disabled={isMutating || planMode}
                                    className="w-full"
                                    onClick={() => {
                                        setAssessmentDraft(createAssessmentDraft(gradebook));
                                        setAssessmentDialogOpen(true);
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4 shrink-0" />
                                    <span>Add Assessment</span>
                                </Button>
                            </div>

                            <div
                                className={cn(
                                    'absolute inset-0 transition-all duration-200',
                                    planMode ? 'opacity-100' : 'pointer-events-none invisible opacity-0',
                                )}
                            >
                                <Button
                                    type="button"
                                    onClick={() => void handleRunPlan()}
                                    disabled={isMutating || !planMode}
                                    className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground"
                                >
                                    <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                                    <span>Auto-fill</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-h-[400px] rounded-md border bg-card flex flex-col overflow-hidden">
                    {gradebook.assessments.length === 0 ? (
                        <AppEmptyState
                            scenario="create"
                            size="section"
                            surface="inherit"
                            className="min-h-[400px] rounded-md"
                            title="No assessments added yet"
                            description="Add your first assessment to start tracking this course."
                            primaryAction={!planMode ? (
                                <Button
                                    type="button"
                                    disabled={isMutating}
                                    onClick={() => {
                                        setAssessmentDraft(createAssessmentDraft(gradebook));
                                        setAssessmentDialogOpen(true);
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Assessment
                                </Button>
                            ) : undefined}
                        />
                    ) : (
                        <DataTable
                            title="Assessments"
                            description="Track weights, due dates, and scores for this course."
                            showHeader={false}
                            items={gradebook.assessments}
                            columns={assessmentColumns}
                            getRowKey={(assessment) => assessment.id}
                            sortPersistenceKey={courseId ? `gradebook-assessments:${courseId}` : undefined}
                            minWidthClassName="min-w-[54rem]"
                            maxBodyHeight={600}
                            freezeHeader
                            rootClassName="flex-1 space-y-0"
                            shellClassName="rounded-none border-0"
                            tableClassName="[&_th]:bg-card [&_td]:bg-card"
                        />
                    )}
                </div>
            </section>

            {assessmentDraft ? (
                <AssessmentDialog
                    open={assessmentDialogOpen}
                    onOpenChange={(open) => {
                        setAssessmentDialogOpen(open);
                        if (!open) {
                            setAssessmentDraft(null);
                        }
                    }}
                    draft={assessmentDraft}
                    onDraftChange={setAssessmentDraft}
                    categories={gradebook.categories}
                    lmsAssignments={lmsAssignmentsQuery.data?.items ?? []}
                    importedLmsAssignmentFingerprints={importedLmsAssignmentFingerprints}
                    hasLmsLink={Boolean(lmsLinkQuery.data)}
                    isSaving={isMutating}
                    onSave={handleSaveAssessment}
                />
            ) : null}

            <AlertDialog open={pendingDeleteAssessment !== null} onOpenChange={(open) => !open && setPendingDeleteAssessment(null)}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingDeleteAssessment ? `Delete assessment ${pendingDeleteAssessment.title}?` : 'Delete assessment?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                if (!pendingDeleteAssessment) return;
                                void commitGradebook(api.deleteCourseGradebookAssessment(courseId, pendingDeleteAssessment.id))
                                    .then((didDelete) => {
                                        if (!didDelete) return;
                                        publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
                                        setPendingDeleteAssessment(null);
                                    });
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={planModeIntroOpen} onOpenChange={setPlanModeIntroOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Enter Plan Mode</DialogTitle>
                        <DialogDescription>
                            Simulate <strong>What If</strong> scores on ungraded assessments to forecast your GPA — no real data is modified.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-4">
                        <li><strong>Graded</strong> assessments stay locked to keep results accurate.</li>
                        <li><strong>Add / Edit / Delete</strong> is disabled until you leave Plan Mode.</li>
                        <li>Set a target in <strong>GPA</strong> or <strong>GPA Percentage</strong>, then tap <strong>Auto-fill</strong>.</li>
                    </ul>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPlanModeIntroOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-amber-500 text-amber-950 hover:bg-amber-400" onClick={enterPlanMode}>
                            Enter Plan Mode
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={planModeExitOpen} onOpenChange={setPlanModeExitOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Plan Mode?</AlertDialogTitle>
                        <AlertDialogDescription>
                            What If scores are temporary and will not be saved after you leave Plan Mode.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep Planning</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={exitPlanMode}>
                            Leave Plan Mode
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

interface SemesterGradebookPlanModeUiState {
    planMode: boolean;
    whatIfDrafts: Record<string, string>;
    targetInputMode: TargetInputMode;
    targetDraft: string;
}

const parseScalingTableJson = (value: string | undefined | null): GradebookScalingTable => {
    const rawValue = value?.trim() || DEFAULT_GPA_SCALING_TABLE_JSON;
    try {
        const parsed = JSON.parse(rawValue) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return JSON.parse(DEFAULT_GPA_SCALING_TABLE_JSON) as GradebookScalingTable;
        }
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, rawGpa]) => [key, Number(rawGpa)] as const)
                .filter(([, gpa]) => Number.isFinite(gpa)),
        );
    } catch {
        return JSON.parse(DEFAULT_GPA_SCALING_TABLE_JSON) as GradebookScalingTable;
    }
};

const getSemesterCourseDisplayName = (course: Course) => course.alias?.trim() || course.name;

const SemesterGradebookTab: React.FC<TabProps> = ({ semesterId }) => {
    const { semester, isLoading } = useSemesterData();
    const {
        state: planModeState,
        setState: setPlanModeState,
    } = usePluginUiState<SemesterGradebookPlanModeUiState>('semester-gradebook-plan-mode', () => ({
        planMode: false,
        whatIfDrafts: {},
        targetInputMode: 'gpa',
        targetDraft: '3.7',
    }));
    const [planModeIntroOpen, setPlanModeIntroOpen] = React.useState(false);
    const [planModeExitOpen, setPlanModeExitOpen] = React.useState(false);

    if (!semesterId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Gradebook unavailable"
                description="This tab requires a semester context."
            />
        );
    }

    if (isLoading && !semester) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-[420px] w-full rounded-lg" />
            </div>
        );
    }

    if (!semester) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Gradebook failed to load"
                description="Semester data is unavailable."
            />
        );
    }

    const courses = semester.courses ?? [];
    const scalingTable = parseScalingTableJson(semester.program?.gpa_scaling_table);
    const resolvedSubjectColorMap = parseSubjectColorMap(semester.program?.subject_color_map);
    const summary = buildSemesterGradebookSummary(courses);
    const whatIfScores = Object.fromEntries(
        Object.entries(planModeState.whatIfDrafts)
            .map(([courseId, value]) => [courseId, parseOptionalNumber(value)] as const)
            .filter((entry): entry is readonly [string, number] => entry[1] !== null),
    );
    const parsedTarget = parseOptionalNumber(planModeState.targetDraft);
    const targetPercentage = parsedTarget === null
        ? null
        : planModeState.targetInputMode === 'gpa'
            ? resolveTargetPercentageForGpa(parsedTarget, scalingTable)
            : parsedTarget;
    const planResult = buildSemesterGradebookPlanResult(courses, whatIfScores, scalingTable, targetPercentage);
    const displayedPercentage = planModeState.planMode ? planResult.projected_percentage : summary.current_percentage;
    const displayedGpa = planModeState.planMode ? planResult.projected_gpa : summary.current_gpa;

    const updatePlanModeState = (patch: Partial<SemesterGradebookPlanModeUiState>) => {
        setPlanModeState((currentState) => ({
            ...currentState,
            ...patch,
        }));
    };

    const handleWhatIfChange = (courseId: string, value: string) => {
        if (!isBoundedPercentageInput(value)) return;
        setPlanModeState((currentState) => ({
            ...currentState,
            whatIfDrafts: {
                ...currentState.whatIfDrafts,
                [courseId]: value,
            },
        }));
    };

    const handleToggleTargetInputMode = () => {
        const nextInputMode: TargetInputMode = planModeState.targetInputMode === 'gpa' ? 'percentage' : 'gpa';
        const parsed = parseOptionalNumber(planModeState.targetDraft);
        const nextDraft = parsed === null
            ? ''
            : nextInputMode === 'percentage'
                ? String(resolveTargetPercentageForGpa(parsed, scalingTable) ?? '')
                : String(calculateGradebookGpa(parsed, scalingTable) ?? '');
        updatePlanModeState({
            targetInputMode: nextInputMode,
            targetDraft: nextDraft,
        });
    };

    const enterPlanMode = () => {
        updatePlanModeState({ planMode: true });
        setPlanModeIntroOpen(false);
    };

    const exitPlanMode = () => {
        updatePlanModeState({ planMode: false, whatIfDrafts: {} });
        setPlanModeExitOpen(false);
    };

    const handlePlanModeCheckedChange = (checked: boolean) => {
        if (checked) {
            setPlanModeIntroOpen(true);
            return;
        }
        setPlanModeExitOpen(true);
    };

    const handleAutoFill = () => {
        if (targetPercentage === null) {
            toast.error(`Enter a ${planModeState.targetInputMode === 'gpa' ? 'GPA' : 'percentage'} target before running Auto-fill.`);
            return;
        }
        const nextDrafts = { ...planModeState.whatIfDrafts };
        courses.forEach((course) => {
            if (course.include_in_gpa === false || Number(course.credits) <= 0) return;
            if (Number(course.grade_percentage || 0) > 0) return;
            nextDrafts[course.id] = String(Math.max(0, Math.min(100, targetPercentage)));
        });
        updatePlanModeState({ whatIfDrafts: nextDrafts });
    };

    const courseColumns: ColumnDef<Course>[] = [
        {
            key: 'name',
            label: 'Course',
            fit: 'fill',
            minWidth: 220,
            sortable: (left, right) => getSemesterCourseDisplayName(left).localeCompare(getSemesterCourseDisplayName(right)),
            cellClassName: 'py-3',
            truncateCell: true,
            cell: (course) => (
                <div className="min-w-0">
                    <Link
                        to={`/courses/${course.id}`}
                        state={{ preferredTabType: BUILTIN_GRADEBOOK_TAB_TYPE }}
                        className="block min-w-0 truncate font-medium text-foreground hover:underline"
                        title={course.name}
                    >
                        {course.name}
                    </Link>
                    {course.alias ? (
                        <div className="truncate text-xs text-muted-foreground" title={course.alias}>
                            {course.alias}
                        </div>
                    ) : null}
                </div>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            width: 132,
            sortable: true,
            cellClassName: 'py-3',
            cell: (course) => course.category?.trim() ? (
                <Badge
                    variant="outline"
                    className={cn(
                        'max-w-full select-none truncate border-0 px-2.5 py-0.5 text-xs font-medium',
                        getCourseCategoryBadgeClassName(course.category),
                    )}
                    style={getCourseBadgeStyle(resolveCourseColor(course, resolvedSubjectColorMap))}
                    title={course.category}
                >
                    {course.category}
                </Badge>
            ) : (
                <span className="text-xs text-muted-foreground/60">None</span>
            ),
        },
        {
            key: 'credits',
            label: 'Credits',
            width: 96,
            align: 'right',
            sortable: true,
            cellClassName: 'py-3',
            cell: (course) => (
                <div className="flex min-h-8 items-center justify-end">
                    <span className="tabular-nums">{Number(course.credits || 0).toFixed(2)}</span>
                </div>
            ),
        },
        {
            key: 'grade_percentage',
            label: planModeState.planMode ? 'What If' : 'Grade',
            width: 112,
            align: 'right',
            sortable: true,
            cellClassName: 'py-3',
            cell: (course) => (
                <div className="flex min-h-8 items-center justify-end">
                    {planModeState.planMode && course.include_in_gpa !== false && Number(course.credits) > 0 && Number(course.grade_percentage || 0) === 0 ? (
                        <Input
                            aria-label={`${course.name} what-if grade`}
                            className="ml-auto h-8 w-24 text-right tabular-nums border-amber-400/80 bg-amber-50/80 text-amber-950 focus-visible:bg-background dark:border-amber-500/50 dark:bg-amber-950/20 dark:text-amber-50"
                            value={planModeState.whatIfDrafts[course.id] ?? ''}
                            inputMode="decimal"
                            placeholder="What if"
                            onChange={(event) => handleWhatIfChange(course.id, event.target.value)}
                        />
                    ) : (
                        <span className="tabular-nums">{formatGradebookGpaPercentage(course.grade_percentage)}</span>
                    )}
                </div>
            ),
        },
        {
            key: 'grade_scaled',
            label: 'GPA',
            width: 96,
            align: 'right',
            sortable: true,
            cellClassName: 'py-3',
            cell: (course) => (
                <div className="flex min-h-8 items-center justify-end">
                    <span className="tabular-nums">{Number(course.grade_scaled || 0).toFixed(2)}</span>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <section className="mb-2.5">
                <div
                    className={cn(
                        'grid select-none rounded-lg border overflow-hidden transition-colors duration-300',
                        planModeState.planMode
                            ? 'border-amber-300/60 dark:border-amber-500/30'
                            : 'border-border/70',
                    )}
                    style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                >
                    <div className={cn(
                        'min-w-0 px-3.5 py-2.5 transition-colors duration-300',
                        planModeState.planMode ? 'bg-amber-50/60 dark:bg-amber-950/25' : '',
                    )}>
                        <div className="flex items-center gap-1.5">
                            {planModeState.planMode
                                ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                                : <Percent className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                            <p className={cn(
                                'truncate text-xs font-medium transition-colors duration-300',
                                planModeState.planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                            )}>
                                {planModeState.planMode ? 'Grade · What If' : 'Grade'}
                            </p>
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                            {displayedPercentage === null ? 'N/A' : planModeState.planMode ? (
                                <span className="text-amber-600 dark:text-amber-400">{formatGradebookGpaPercentage(displayedPercentage)}</span>
                            ) : formatGradebookGpaPercentage(displayedPercentage)}
                        </div>
                    </div>
                    <div className={cn(
                        'min-w-0 border-l px-3.5 py-2.5 transition-colors duration-300',
                        planModeState.planMode
                            ? 'border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/25'
                            : 'border-border/70',
                    )}>
                        <div className="flex items-center gap-1.5">
                            {planModeState.planMode
                                ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                                : <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                            <p className={cn(
                                'truncate text-xs font-medium transition-colors duration-300',
                                planModeState.planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                            )}>
                                {planModeState.planMode ? 'GPA · What If' : 'GPA'}
                            </p>
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                            {displayedGpa === null ? 'N/A' : planModeState.planMode ? (
                                <span className="text-amber-600 dark:text-amber-400">{displayedGpa.toFixed(2)}</span>
                            ) : displayedGpa.toFixed(2)}
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">Semester Gradebook</h2>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex h-11 w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                            <Label htmlFor="semester-gradebook-plan-mode" className="flex items-center gap-2 text-sm font-medium tracking-tight">
                                <Sparkles className={cn('h-4 w-4', planModeState.planMode ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground')} />
                                <span>Plan Mode</span>
                            </Label>
                            <Switch
                                id="semester-gradebook-plan-mode"
                                checked={planModeState.planMode}
                                onCheckedChange={handlePlanModeCheckedChange}
                                className="data-checked:bg-amber-500 data-unchecked:bg-slate-300/80 dark:data-unchecked:bg-slate-700"
                                aria-label="Toggle Plan Mode"
                            />
                        </div>
                        {planModeState.planMode ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <Target className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                                <Label htmlFor="semester-gradebook-target" className="shrink-0 text-sm font-medium whitespace-nowrap">
                                    Target
                                </Label>
                                <InputGroup className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                                    <InputGroupInput
                                        id="semester-gradebook-target"
                                        aria-label={planModeState.targetInputMode === 'gpa' ? 'Target GPA' : 'Target %'}
                                        className="tabular-nums"
                                        value={planModeState.targetDraft}
                                        inputMode="decimal"
                                        placeholder={planModeState.targetInputMode === 'gpa' ? '3.70' : '85.0'}
                                        onChange={(event) => updatePlanModeState({ targetDraft: event.target.value })}
                                    />
                                    <InputGroupAddon align="inline-end">
                                        <InputGroupText>{planModeState.targetInputMode === 'gpa' ? 'GPA' : '%'}</InputGroupText>
                                    </InputGroupAddon>
                                </InputGroup>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleToggleTargetInputMode}
                                    aria-label={planModeState.targetInputMode === 'gpa' ? 'Switch target input to GPA Percentage' : 'Switch target input to GPA'}
                                    title={planModeState.targetInputMode === 'gpa' ? 'Switch to GPA Percentage' : 'Switch to GPA'}
                                >
                                    <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span>{planModeState.targetInputMode === 'gpa' ? 'Use %' : 'Use GPA'}</span>
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    <div className="w-full shrink-0 sm:w-auto">
                        <div
                            className={cn(
                                'transition-all duration-200 sm:w-[184px]',
                                planModeState.planMode ? 'opacity-100' : 'pointer-events-none invisible opacity-0',
                            )}
                        >
                            <Button
                                type="button"
                                onClick={handleAutoFill}
                                disabled={!planModeState.planMode}
                                className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground"
                            >
                                <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                                <span>Auto-fill</span>
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="min-h-[400px] rounded-md border bg-card flex flex-col overflow-hidden">
                    <DataTable
                        title="Semester Courses"
                        description={`${summary.included_course_count} course${summary.included_course_count === 1 ? '' : 's'} included in GPA · ${summary.included_credits.toFixed(2)} credits`}
                        showHeader={false}
                        items={courses}
                        columns={courseColumns}
                        getRowKey={(course) => course.id}
                        emptyMessage="No courses assigned."
                        sortPersistenceKey={semesterId ? `gradebook-semester-courses:${semesterId}` : undefined}
                        minWidthClassName="min-w-[54rem]"
                        maxBodyHeight={600}
                        freezeHeader
                        rootClassName="flex-1 space-y-0"
                        shellClassName="rounded-none border-0"
                        tableClassName="[&_th]:bg-card [&_td]:bg-card"
                    />
                </div>
            </section>

            <Dialog open={planModeIntroOpen} onOpenChange={setPlanModeIntroOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Enter Plan Mode</DialogTitle>
                        <DialogDescription>
                            Simulate <strong>What If</strong> scores on ungraded courses to project your semester GPA — no real data is modified.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-4">
                        <li><strong>Courses with grades</strong> stay locked to keep results accurate.</li>
                        <li>Set a target in <strong>GPA</strong> or <strong>GPA Percentage</strong>, then tap <strong>Auto-fill</strong>.</li>
                    </ul>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPlanModeIntroOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-amber-500 text-amber-950 hover:bg-amber-400" onClick={enterPlanMode}>
                            Enter Plan Mode
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={planModeExitOpen} onOpenChange={setPlanModeExitOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Plan Mode?</AlertDialogTitle>
                        <AlertDialogDescription>
                            What If scores are temporary and will not be saved after you leave Plan Mode.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep Planning</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={exitPlanMode}>
                            Leave Plan Mode
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const BuiltinGradebookTab: React.FC<TabProps> = (props) => {
    if (props.courseId) {
        return <CourseGradebookTab {...props} />;
    }
    if (props.semesterId) {
        return <SemesterGradebookTab {...props} />;
    }
    return (
        <AppEmptyState
            scenario="unavailable"
            size="section"
            title="Gradebook unavailable"
            description="This tab requires a course or semester context."
        />
    );
};

export const BuiltinGradebookTabDefinition: TabDefinition = {
    type: BUILTIN_GRADEBOOK_TAB_TYPE,
    component: BuiltinGradebookTab,
};
