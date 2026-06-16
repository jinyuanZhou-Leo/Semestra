import { format } from 'date-fns';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import React from 'react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { DataTable, DataTableActionMenu, type ColumnDef } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CourseGradebook, GradebookAssessment, GradebookAssessmentCategory } from '@/services/api';
import { cn } from '@/lib/utils';
import {
    formatGradebookDate,
    formatGradebookDateInput,
    formatPercent,
    getCategoryBadgeClassName,
    getCategoryBadgeStyle,
    getCategoryById,
    getRelativeDueText,
    isAssessmentOverdue,
    parseDraftDate,
} from '../shared';
import { createAssessmentDraft } from './AssessmentDialog';
import { isBoundedPercentageInput } from '../utils/gradebookTabUtils';

export interface CourseAssessmentsTableState {
    planMode: boolean;
    canManageAssessments: boolean;
    isMutating: boolean;
    scoreDrafts: Record<string, string>;
    weightDrafts: Record<string, string>;
    dueDateDrafts: Record<string, string>;
    whatIfDrafts: Record<string, string>;
    editingScoreAssessmentId: string | null;
    editingWeightAssessmentId: string | null;
    editingDueDateAssessmentId: string | null;
}

export interface CourseAssessmentsTableActions {
    setScoreDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setWeightDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setDueDateDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setEditingScoreAssessmentId: React.Dispatch<React.SetStateAction<string | null>>;
    setEditingWeightAssessmentId: React.Dispatch<React.SetStateAction<string | null>>;
    setEditingDueDateAssessmentId: React.Dispatch<React.SetStateAction<string | null>>;
    setWhatIfDrafts: (patch: Record<string, string>) => void;
    onSaveScore: (assessment: GradebookAssessment) => void;
    onSaveWeight: (assessment: GradebookAssessment) => void;
    onSaveDueDate: (assessment: GradebookAssessment, nextDueDate: string) => void;
    onEditAssessment: (assessment: GradebookAssessment) => void;
    onDeleteAssessment: (assessment: GradebookAssessment) => void;
    onAddAssessment: () => void;
}

interface UseCourseAssessmentColumnsOptions {
    gradebook: CourseGradebook | null;
    categoriesById: Map<string, GradebookAssessmentCategory>;
    state: CourseAssessmentsTableState;
    actions: CourseAssessmentsTableActions;
}

export function useCourseAssessmentColumns({
    gradebook,
    categoriesById,
    state,
    actions,
}: UseCourseAssessmentColumnsOptions): ColumnDef<GradebookAssessment>[] {
    const {
        planMode,
        canManageAssessments,
        isMutating,
        scoreDrafts,
        weightDrafts,
        dueDateDrafts,
        whatIfDrafts,
        editingWeightAssessmentId,
        editingDueDateAssessmentId,
    } = state;

    return React.useMemo(() => {
        if (!gradebook) return [];

        return [
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
                            actions.setEditingDueDateAssessmentId(open ? assessment.id : null);
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
                                    void actions.onSaveDueDate(
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
                                            void actions.onSaveDueDate(assessment, '');
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
                                actions.setWeightDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                            }}
                            onBlur={() => {
                                void actions.onSaveWeight(assessment);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void actions.onSaveWeight(assessment);
                                }
                                if (event.key === 'Escape') {
                                    actions.setWeightDrafts((current) => ({
                                        ...current,
                                        [assessment.id]: String(assessment.weight),
                                    }));
                                    actions.setEditingWeightAssessmentId(null);
                                }
                            }}
                        />
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            className="ml-auto h-auto px-0 py-0 text-right tabular-nums hover:bg-transparent"
                            disabled={!canManageAssessments}
                            onClick={() => actions.setEditingWeightAssessmentId(assessment.id)}
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
                                actions.setWhatIfDrafts({ [assessment.id]: nextValue });
                                return;
                            }
                            if (!isBoundedPercentageInput(nextValue)) {
                                return;
                            }
                            actions.setScoreDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                        }}
                        onFocus={() => {
                            if (!planMode) {
                                actions.setEditingScoreAssessmentId(assessment.id);
                            }
                        }}
                        onBlur={() => {
                            if (!planMode) {
                                actions.setEditingScoreAssessmentId(null);
                                void actions.onSaveScore(assessment);
                            }
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !planMode) {
                                event.preventDefault();
                                void actions.onSaveScore(assessment);
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
                        onClick={() => actions.onEditAssessment(assessment)}
                    >
                        <Pencil className="h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        disabled={!canManageAssessments}
                        onClick={() => actions.onDeleteAssessment(assessment)}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DataTableActionMenu>
            ),
        },
    ];
    }, [
        actions,
        canManageAssessments,
        categoriesById,
        dueDateDrafts,
        editingDueDateAssessmentId,
        editingWeightAssessmentId,
        gradebook,
        isMutating,
        planMode,
        scoreDrafts,
        weightDrafts,
        whatIfDrafts,
    ]);
}

interface CourseAssessmentsTableProps {
    courseId: string;
    gradebook: CourseGradebook;
    columns: ColumnDef<GradebookAssessment>[];
    planMode: boolean;
    isMutating: boolean;
    onAddAssessment: () => void;
}

export function CourseAssessmentsTable({
    courseId,
    gradebook,
    columns,
    planMode,
    isMutating,
    onAddAssessment,
}: CourseAssessmentsTableProps) {
    return (
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
                            onClick={onAddAssessment}
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
                    columns={columns}
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
    );
}

export { createAssessmentDraft };
