// input:  [assessment draft state setter, gradebook categories, LMS assignments, LMS import fingerprints, save callback, date formatting helpers, and shadcn dialog/form/calendar primitives]
// output: [`AssessmentDialog`, `AssessmentDraft`, and `createAssessmentDraft` for manual or LMS-backed gradebook assessment creation/editing]
// pos:    [builtin-gradebook form subcomponent that owns add/edit assessment UI, LMS assignment selection, and shared draft-shape creation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarDays, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
    CourseGradebook,
    GradebookAssessment,
    GradebookAssessmentCategory,
    LmsAssignmentSummary,
} from '@/services/api';

import { formatGradebookDateInput } from '../shared';

export type AssessmentDraft = {
    id: string | null;
    source_mode: 'manual' | 'lms';
    score_mode: 'percent' | 'points';
    title: string;
    category_id: string | null;
    due_date: string;
    weight: string;
    score: string;
    points_earned: string;
    points_possible: string;
    selected_lms_assignment_ids: string[];
};

type AssessmentDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draft: AssessmentDraft;
    onDraftChange: React.Dispatch<React.SetStateAction<AssessmentDraft | null>>;
    categories: GradebookAssessmentCategory[];
    lmsAssignments: LmsAssignmentSummary[];
    importedLmsAssignmentFingerprints: Set<string>;
    hasLmsLink: boolean;
    isSaving: boolean;
    onSave: () => Promise<void>;
};

const parseDraftDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
};

const formatLmsDueDate = (value: string | null | undefined) => {
    if (!value) return 'No due date';
    const parsed = parseISO(value);
    return isValid(parsed) ? format(parsed, 'MMM d, yyyy p') : 'No due date';
};

const getLmsAssignmentFingerprint = (assignment: Pick<LmsAssignmentSummary, 'title' | 'due_date'>) => {
    const dueDate = assignment.due_date ?? '';
    return `${assignment.title.trim().toLowerCase()}::${dueDate}`;
};

export const createAssessmentDraft = (
    gradebook: CourseGradebook,
    assessment?: GradebookAssessment | null,
): AssessmentDraft => ({
    id: assessment?.id ?? null,
    source_mode: 'manual',
    score_mode: assessment?.points_earned !== null && assessment?.points_possible !== null ? 'points' : 'percent',
    title: assessment?.title ?? '',
    category_id: assessment?.category_id ?? gradebook.categories.find((category) => !category.is_archived)?.id ?? null,
    due_date: formatGradebookDateInput(assessment?.due_date),
    weight: assessment ? String(assessment.weight) : '',
    score: assessment?.score === null || assessment?.score === undefined ? '' : String(assessment.score),
    points_earned: assessment?.points_earned === null || assessment?.points_earned === undefined ? '' : String(assessment.points_earned),
    points_possible: assessment?.points_possible === null || assessment?.points_possible === undefined ? '' : String(assessment.points_possible),
    selected_lms_assignment_ids: [],
});

export const AssessmentDialog: React.FC<AssessmentDialogProps> = ({
    open,
    onOpenChange,
    draft,
    onDraftChange,
    categories,
    lmsAssignments,
    importedLmsAssignmentFingerprints,
    hasLmsLink,
    isSaving,
    onSave,
}) => {
    const setField = <K extends keyof AssessmentDraft>(field: K, value: AssessmentDraft[K]) => {
        onDraftChange((current) => current ? { ...current, [field]: value } : current);
    };
    const dueDate = parseDraftDate(draft.due_date);
    const canImportFromLms = !draft.id && hasLmsLink && lmsAssignments.length > 0;
    const selectedLmsCount = draft.selected_lms_assignment_ids.length;
    const selectableLmsAssignments = lmsAssignments.filter((assignment) => !importedLmsAssignmentFingerprints.has(getLmsAssignmentFingerprint(assignment)));
    const allSelectableLmsIds = selectableLmsAssignments.map((assignment) => assignment.external_id);
    const hasAllSelectableChecked = allSelectableLmsIds.length > 0
        && allSelectableLmsIds.every((assignmentId) => draft.selected_lms_assignment_ids.includes(assignmentId));

    const toggleSelectedLmsAssignment = (externalId: string, checked: boolean) => {
        setField(
            'selected_lms_assignment_ids',
            checked
                ? Array.from(new Set([...draft.selected_lms_assignment_ids, externalId]))
                : draft.selected_lms_assignment_ids.filter((id) => id !== externalId),
        );
    };

    const toggleAllSelectableLmsAssignments = (checked: boolean) => {
        setField('selected_lms_assignment_ids', checked ? allSelectableLmsIds : []);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>{draft.id ? 'Edit Assessment' : 'Add Assessment'}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {draft.id
                            ? 'Edit the details of this assessment.'
                            : canImportFromLms
                                ? 'Create an assessment manually or add one or more assignments from LMS as local Gradebook rows.'
                                : 'Enter the details for the new assessment.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
                    {!draft.id && canImportFromLms ? (
                        <Tabs value={draft.source_mode} onValueChange={(value) => setField('source_mode', value as AssessmentDraft['source_mode'])}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="manual">Create</TabsTrigger>
                                <TabsTrigger value="lms">From LMS</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    ) : null}

                    <div className="h-[min(68vh,560px)] min-h-0 overflow-hidden">
                        {draft.source_mode === 'lms' && !draft.id ? (
                            <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={draft.category_id ?? 'none'} onValueChange={(value) => setField('category_id', value === 'none' ? null : value)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="none">Uncategorized</SelectItem>
                                                {categories.filter((category) => !category.is_archived).map((category) => (
                                                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Imported LMS assignments become local Gradebook assessments. Weight starts at 0% so you can refine it later.
                                    </p>
                                </div>

                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70">
                                    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                                        <div>
                                            <div className="text-sm font-medium text-foreground">Assignments from LMS</div>
                                            <p className="text-xs text-muted-foreground">
                                                Select one or more assignments to add as local assessments.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Checkbox
                                                checked={hasAllSelectableChecked}
                                                disabled={allSelectableLmsIds.length === 0}
                                                onCheckedChange={(checked) => toggleAllSelectableLmsAssignments(Boolean(checked))}
                                            />
                                            <span>Select all</span>
                                        </div>
                                    </div>
                                    <ScrollArea className="min-h-[320px] flex-1">
                                        {lmsAssignments.map((assignment) => {
                                            const isImported = importedLmsAssignmentFingerprints.has(getLmsAssignmentFingerprint(assignment));
                                            const isChecked = draft.selected_lms_assignment_ids.includes(assignment.external_id);
                                            return (
                                                <label
                                                    key={assignment.external_id}
                                                    className={cn(
                                                        'flex cursor-pointer items-start gap-3 border-b px-4 py-3 last:border-b-0',
                                                        isImported && 'cursor-not-allowed opacity-60',
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={isChecked}
                                                        disabled={isImported}
                                                        onCheckedChange={(checked) => toggleSelectedLmsAssignment(assignment.external_id, Boolean(checked))}
                                                    />
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate text-sm font-medium text-foreground">{assignment.title}</span>
                                                            {isImported ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                                    <Check className="h-3 w-3" />
                                                                    Added
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                            <span>{assignment.course_display_code}</span>
                                                            <span>{formatLmsDueDate(assignment.due_at)}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </ScrollArea>
                                </div>
                            </div>
                        ) : (
                            <ScrollArea className="h-full min-h-0 flex-1">
                                <div className="space-y-3 pr-3">
                                    <h3 className="text-sm font-medium text-foreground">Details</h3>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label>Title</Label>
                                            <Input value={draft.title} onChange={(event) => setField('title', event.target.value)} placeholder="Final exam" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Category</Label>
                                            <Select value={draft.category_id ?? 'none'} onValueChange={(value) => setField('category_id', value === 'none' ? null : value)}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select a category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value="none">Uncategorized</SelectItem>
                                                        {categories.filter((category) => !category.is_archived).map((category) => (
                                                            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Due date</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className={cn(
                                                            'w-full justify-start overflow-hidden text-left font-normal',
                                                            !dueDate && 'text-muted-foreground',
                                                        )}
                                                    >
                                                        <CalendarDays className="mr-2 h-4 w-4" />
                                                        <span className="truncate">
                                                            {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Pick a date'}
                                                        </span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        autoFocus
                                                        mode="single"
                                                        selected={dueDate}
                                                        onSelect={(date) => setField('due_date', date ? format(date, 'yyyy-MM-dd') : '')}
                                                    />
                                                    {dueDate ? (
                                                        <div className="flex justify-end border-t px-3 py-2">
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => setField('due_date', '')}>
                                                                Clear
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-6" />

                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-foreground">Grading</h3>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Weight (%)</Label>
                                            <Input value={draft.weight} inputMode="decimal" onChange={(event) => setField('weight', event.target.value)} placeholder="20" />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label>Score input</Label>
                                            <RadioGroup
                                                value={draft.score_mode}
                                                onValueChange={(value) => setField('score_mode', value as AssessmentDraft['score_mode'])}
                                                className="grid gap-2 sm:grid-cols-2"
                                            >
                                                <label
                                                    className={cn(
                                                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                                                        draft.score_mode === 'percent'
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-border/70 hover:bg-muted/30',
                                                    )}
                                                >
                                                    <RadioGroupItem value="percent" />
                                                    <span className="text-sm font-medium text-foreground">Percentage</span>
                                                </label>
                                                <label
                                                    className={cn(
                                                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                                                        draft.score_mode === 'points'
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-border/70 hover:bg-muted/30',
                                                    )}
                                                >
                                                    <RadioGroupItem value="points" />
                                                    <span className="text-sm font-medium text-foreground">Points</span>
                                                </label>
                                            </RadioGroup>
                                        </div>
                                        {draft.score_mode === 'points' ? (
                                            <>
                                                <div className="space-y-2">
                                                    <Label>Points earned</Label>
                                                    <Input value={draft.points_earned} inputMode="decimal" onChange={(event) => setField('points_earned', event.target.value)} placeholder="18" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Points possible</Label>
                                                    <Input value={draft.points_possible} inputMode="decimal" onChange={(event) => setField('points_possible', event.target.value)} placeholder="20" />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label>Score (%)</Label>
                                                <Input value={draft.score} inputMode="decimal" onChange={(event) => setField('score', event.target.value)} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </div>

                <DialogFooter className="w-full">
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
                            {draft.id ? 'Save Changes' : draft.source_mode === 'lms' ? `Add ${selectedLmsCount || ''} ${selectedLmsCount === 1 ? 'Assessment' : 'Assessments'}`.trim() : 'Add Assessment'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
