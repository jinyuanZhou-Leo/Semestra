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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import type { GradebookAssessment } from '@/services/api';

interface PlanModeDialogsProps {
    introOpen: boolean;
    exitOpen: boolean;
    onIntroOpenChange: (open: boolean) => void;
    onExitOpenChange: (open: boolean) => void;
    onEnterPlanMode: () => void;
    onExitPlanMode: () => void;
    scope: 'course' | 'semester';
}

export function PlanModeDialogs({
    introOpen,
    exitOpen,
    onIntroOpenChange,
    onExitOpenChange,
    onEnterPlanMode,
    onExitPlanMode,
    scope,
}: PlanModeDialogsProps) {
    const isCourse = scope === 'course';

    return (
        <>
            <Dialog open={introOpen} onOpenChange={onIntroOpenChange}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Enter Plan Mode</DialogTitle>
                        <DialogDescription>
                            Simulate <strong>What If</strong> scores on ungraded {isCourse ? 'assessments' : 'courses'} to {isCourse ? 'forecast your GPA' : 'project your semester GPA'} — no real data is modified.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-4">
                        {isCourse ? (
                            <>
                                <li><strong>Graded</strong> assessments stay locked to keep results accurate.</li>
                                <li><strong>Add / Edit / Delete</strong> is disabled until you leave Plan Mode.</li>
                            </>
                        ) : (
                            <li><strong>Courses with grades</strong> stay locked to keep results accurate.</li>
                        )}
                        <li>Set a target in <strong>GPA</strong> or <strong>GPA Percentage</strong>, then tap <strong>Auto-fill</strong>.</li>
                    </ul>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onIntroOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-amber-500 text-amber-950 hover:bg-amber-400" onClick={onEnterPlanMode}>
                            Enter Plan Mode
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={exitOpen} onOpenChange={onExitOpenChange}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Plan Mode?</AlertDialogTitle>
                        <AlertDialogDescription>
                            What If scores are temporary and will not be saved after you leave Plan Mode.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep Planning</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={onExitPlanMode}>
                            Leave Plan Mode
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

interface CourseGradebookConfirmDialogsProps {
    finalGradeConfirmOpen: boolean;
    finalGradeRemoveConfirmOpen: boolean;
    pendingDeleteAssessment: GradebookAssessment | null;
    finalGradeDraft: string;
    finalGradeError: string | null;
    isMutating: boolean;
    onFinalGradeConfirmOpenChange: (open: boolean) => void;
    onFinalGradeRemoveConfirmOpenChange: (open: boolean) => void;
    onPendingDeleteAssessmentChange: (assessment: GradebookAssessment | null) => void;
    onFinalGradeDraftChange: (value: string) => void;
    onSaveFinalGradeOverride: () => void;
    onClearFinalGradeOverride: () => void;
    onConfirmDeleteAssessment: () => void;
}

export function CourseGradebookConfirmDialogs({
    finalGradeConfirmOpen,
    finalGradeRemoveConfirmOpen,
    pendingDeleteAssessment,
    finalGradeDraft,
    finalGradeError,
    isMutating,
    onFinalGradeConfirmOpenChange,
    onFinalGradeRemoveConfirmOpenChange,
    onPendingDeleteAssessmentChange,
    onFinalGradeDraftChange,
    onSaveFinalGradeOverride,
    onClearFinalGradeOverride,
    onConfirmDeleteAssessment,
}: CourseGradebookConfirmDialogsProps) {
    return (
        <>
            <AlertDialog open={finalGradeConfirmOpen} onOpenChange={onFinalGradeConfirmOpenChange}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Use this as the final grade?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Final grade overrides the calculated assessment total for this course.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Field data-invalid={finalGradeError ? true : undefined}>
                        <InputGroup>
                            <InputGroupInput
                                value={finalGradeDraft}
                                inputMode="decimal"
                                aria-label="Final grade"
                                aria-invalid={Boolean(finalGradeError)}
                                className="tabular-nums"
                                onChange={(event) => onFinalGradeDraftChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void onSaveFinalGradeOverride();
                                    }
                                }}
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupText>%</InputGroupText>
                            </InputGroupAddon>
                        </InputGroup>
                        <FieldError>{finalGradeError}</FieldError>
                    </Field>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                            type="button"
                            onClick={() => void onSaveFinalGradeOverride()}
                            disabled={isMutating}
                        >
                            Set Final Grade
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={finalGradeRemoveConfirmOpen} onOpenChange={onFinalGradeRemoveConfirmOpenChange}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove final grade?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The course grade will return to the calculated assessment total when available.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void onClearFinalGradeOverride()}
                            disabled={isMutating}
                        >
                            Remove
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={pendingDeleteAssessment !== null}
                onOpenChange={(open) => !open && onPendingDeleteAssessmentChange(null)}
            >
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
                            onClick={() => void onConfirmDeleteAssessment()}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
