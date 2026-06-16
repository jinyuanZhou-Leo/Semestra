import { Award } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import type { ComputedGradebookSummary } from '../shared';

interface CourseFinalGradeSectionProps {
    summary: ComputedGradebookSummary;
    finalGradeDraft: string;
    finalGradeError: string | null;
    isMutating: boolean;
    onFinalGradeDraftChange: (value: string) => void;
    onSaveExistingFinalGradeOverride: () => void;
    onSetFinalGradeClick: () => void;
    onRemoveFinalGradeClick: () => void;
}

export function CourseFinalGradeSection({
    summary,
    finalGradeDraft,
    finalGradeError,
    isMutating,
    onFinalGradeDraftChange,
    onSaveExistingFinalGradeOverride,
    onSetFinalGradeClick,
    onRemoveFinalGradeClick,
}: CourseFinalGradeSectionProps) {
    return (
        <section className="flex flex-col gap-3 rounded-lg border px-3.5 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Award className="size-4" aria-hidden="true" />
                </div>
                <div className="flex min-h-10 min-w-0 flex-col justify-center">
                    <h2 className="text-sm font-medium tracking-tight">Final grade</h2>
                    <p className="text-sm text-muted-foreground">
                        Enter the final total when the course publishes one.
                    </p>
                </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start lg:w-auto">
                {summary.has_final_grade_override ? (
                    <>
                        <Field data-invalid={finalGradeError ? true : undefined} className="min-w-0 flex-1 sm:w-44 sm:flex-none">
                            <InputGroup>
                                <InputGroupInput
                                    id="gradebook-final-grade"
                                    value={finalGradeDraft}
                                    inputMode="decimal"
                                    aria-label="Final grade"
                                    aria-invalid={Boolean(finalGradeError)}
                                    className="tabular-nums"
                                    onChange={(event) => onFinalGradeDraftChange(event.target.value)}
                                    onBlur={() => void onSaveExistingFinalGradeOverride()}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            void onSaveExistingFinalGradeOverride();
                                        }
                                    }}
                                />
                                <InputGroupAddon align="inline-end">
                                    <InputGroupText>%</InputGroupText>
                                </InputGroupAddon>
                            </InputGroup>
                            <FieldError>{finalGradeError}</FieldError>
                        </Field>
                        <Button
                            type="button"
                            variant="destructive"
                            className="w-full shrink-0 sm:w-auto"
                            disabled={isMutating}
                            onClick={onRemoveFinalGradeClick}
                        >
                            Remove
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full shrink-0 sm:w-auto"
                        onClick={onSetFinalGradeClick}
                        disabled={isMutating}
                    >
                        <Award data-icon="inline-start" />
                        Set Final Grade
                    </Button>
                )}
            </div>
        </section>
    );
}
