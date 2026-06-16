import { ArrowRightLeft, Plus, Sparkles, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { TargetInputMode } from '../utils/gradebookTabUtils';

interface CourseGradebookActionBarProps {
    planMode: boolean;
    targetInputMode: TargetInputMode;
    targetGpaDraft: string;
    isMutating: boolean;
    hasFinalGradeOverride: boolean;
    onPlanModeCheckedChange: (checked: boolean) => void;
    onTargetGpaDraftChange: (value: string) => void;
    onPersistTargetGpa: () => void;
    onToggleTargetInputMode: () => void;
    onAddAssessment: () => void;
    onRunPlan: () => void;
}

export function CourseGradebookActionBar({
    planMode,
    targetInputMode,
    targetGpaDraft,
    isMutating,
    hasFinalGradeOverride,
    onPlanModeCheckedChange,
    onTargetGpaDraftChange,
    onPersistTargetGpa,
    onToggleTargetInputMode,
    onAddAssessment,
    onRunPlan,
}: CourseGradebookActionBarProps) {
    return (
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
                        onCheckedChange={onPlanModeCheckedChange}
                        disabled={isMutating || hasFinalGradeOverride}
                        className="data-checked:bg-amber-500 data-unchecked:bg-slate-300/80 dark:data-unchecked:bg-slate-700"
                        aria-label="Toggle Plan Mode"
                    />
                </div>

                {planMode ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                                onChange={(event) => onTargetGpaDraftChange(event.target.value)}
                                onBlur={() => void onPersistTargetGpa()}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void onPersistTargetGpa();
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
                            onClick={onToggleTargetInputMode}
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
                            onClick={onAddAssessment}
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
                            onClick={() => void onRunPlan()}
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
    );
}
