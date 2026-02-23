// input:  [raw import payload, conflict strategy options, include-settings flag, confirm callbacks]
// output: [`ImportPreviewModal` component and import helper types]
// pos:    [Settings workflow modal for previewing and confirming account data import]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowRight, ChevronRight, FileDown, Loader2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProgramExport {
    name: string;
    cgpa_scaled: number;
    cgpa_percentage: number;
    gpa_scaling_table?: string;
    grad_requirement_credits: number;
    hide_gpa: boolean;
    semesters: SemesterExport[];
}

export interface SemesterExport {
    name: string;
    average_percentage: number;
    average_scaled: number;
    courses: CourseExport[];
    widgets: any[];
    tabs: any[];
}

export interface CourseExport {
    name: string;
    alias?: string;
    credits: number;
    grade_percentage: number;
    grade_scaled: number;
    include_in_gpa: boolean;
    hide_gpa: boolean;
    widgets: any[];
    tabs: any[];
}

export interface ImportData {
    version?: string;
    exported_at?: string;
    settings?: {
        nickname?: string;
        gpa_scaling_table?: string;
        default_course_credit?: number;
    };
    programs: ProgramExport[];
}

export type ConflictMode = 'skip' | 'overwrite' | 'rename';

interface ImportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    importData: ImportData | null;
    existingProgramNames: string[];
    onConfirm: (mode: ConflictMode, includeSettings: boolean) => Promise<void>;
}

const conflictOptions: { value: ConflictMode; label: string; description: string }[] = [
    { value: 'skip', label: 'Skip', description: 'Keep existing' },
    { value: 'overwrite', label: 'Overwrite', description: 'Replace existing' },
    { value: 'rename', label: 'Rename', description: 'Keep both' }
];

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
    isOpen,
    onClose,
    importData,
    existingProgramNames,
    onConfirm
}) => {
    const [conflictMode, setConflictMode] = useState<ConflictMode>('skip');
    const [includeSettings, setIncludeSettings] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const radioBaseId = useId();
    const includeSettingsId = useId();

    const analysis = useMemo(() => {
        if (!importData) {
            return {
                newPrograms: [],
                conflictPrograms: [],
                totalSemesters: 0,
                totalCourses: 0
            };
        }

        const existingNamesLower = new Set(existingProgramNames.map(n => n.toLowerCase()));
        const newPrograms: string[] = [];
        const conflictPrograms: string[] = [];
        let totalSemesters = 0;
        let totalCourses = 0;

        for (const program of importData.programs) {
            if (existingNamesLower.has(program.name.toLowerCase())) {
                conflictPrograms.push(program.name);
            } else {
                newPrograms.push(program.name);
            }
            totalSemesters += program.semesters.length;
            for (const semester of program.semesters) {
                totalCourses += semester.courses.length;
            }
        }

        return { newPrograms, conflictPrograms, totalSemesters, totalCourses };
    }, [importData, existingProgramNames]);

    const conflictNameSet = useMemo(
        () => new Set(analysis.conflictPrograms.map((name) => name.toLowerCase())),
        [analysis.conflictPrograms]
    );

    const programs = importData?.programs ?? [];
    const programCount = programs.length;
    const hasImportSettings = Boolean(importData?.settings);
    const hasPrograms = programCount > 0;
    const exportedAt = useMemo(() => {
        if (!importData?.exported_at) return null;
        const parsed = new Date(importData.exported_at);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toLocaleString();
    }, [importData?.exported_at]);

    const handleConfirm = async () => {
        if (!hasPrograms) return;
        setIsImporting(true);
        try {
            await onConfirm(conflictMode, hasImportSettings ? includeSettings : false);
            toast.success('Import successful');
            onClose();
        } catch (error: any) {
            console.error('Import failed:', error);
            toast.error('Import failed', {
                description: error.message || 'An unexpected error occurred during import.',
                action: {
                    label: 'Retry',
                    onClick: handleConfirm,
                },
            });
        } finally {
            setIsImporting(false);
        }
    };

    if (!importData) return null;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !isImporting) {
                    onClose();
                }
            }}
        >
            <DialogContent className="select-none flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
                <DialogHeader className="gap-1 border-b bg-muted/20 px-5 py-4">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                        <FileDown className="size-4 text-primary" />
                        Import Preview
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Review imported data and confirm import.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="space-y-4 p-5">
                            <div className="rounded-md border bg-muted/25 px-2 py-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary" className="h-5 bg-background px-2 text-[11px] text-foreground/90">
                                        Programs <span className="ml-1 font-semibold">{programCount}</span>
                                    </Badge>
                                    <Badge variant="secondary" className="h-5 bg-background px-2 text-[11px] text-foreground/90">
                                        Semesters <span className="ml-1 font-semibold">{analysis.totalSemesters}</span>
                                    </Badge>
                                    <Badge variant="secondary" className="h-5 bg-background px-2 text-[11px] text-foreground/90">
                                        Courses <span className="ml-1 font-semibold">{analysis.totalCourses}</span>
                                    </Badge>
                                    <Badge
                                        variant="secondary"
                                        className={cn(
                                            'h-5 px-2 text-[11px]',
                                            analysis.conflictPrograms.length > 0
                                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                                : 'bg-background text-foreground/90'
                                        )}
                                    >
                                        Conflicts <span className="ml-1 font-semibold">{analysis.conflictPrograms.length}</span>
                                    </Badge>
                                    {hasImportSettings && (
                                        <Badge variant="secondary" className="h-5 bg-background px-2 text-[11px] text-foreground/90">
                                            Account settings <span className="ml-1 font-semibold">1</span>
                                        </Badge>
                                    )}
                                </div>
                                {(exportedAt || importData.version) && (
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                                        {exportedAt && <span>Exported: {exportedAt}</span>}
                                        {importData.version && <span>Version: {importData.version}</span>}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Programs in this backup
                                </h3>
                                <Card className="h-[320px] overflow-hidden border-muted">
                                    <ScrollArea className="h-full">
                                        <div className="divide-y divide-muted/40">
                                            {programs.map((program, programIndex) => {
                                                const isConflict = conflictNameSet.has(program.name.toLowerCase());
                                                const programCourseCount = program.semesters.reduce((total, semester) => total + semester.courses.length, 0);
                                                return (
                                                    <Collapsible
                                                        key={`${program.name}-${programIndex}`}
                                                        defaultOpen={programIndex === 0}
                                                        className="group/program"
                                                    >
                                                        <CollapsibleTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                                                            >
                                                                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/program:rotate-90" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="truncate font-medium">{program.name}</span>
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className={cn(
                                                                                'h-5 px-2 text-[11px]',
                                                                                isConflict
                                                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                                                                    : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                                            )}
                                                                        >
                                                                            {isConflict ? 'Conflict' : 'New'}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="truncate text-xs text-muted-foreground">
                                                                        CGPA {program.cgpa_scaled} ({program.cgpa_percentage}%) · Grad Credits {program.grad_requirement_credits}
                                                                        {program.gpa_scaling_table ? ` · Scale ${program.gpa_scaling_table}` : ''}
                                                                        {program.hide_gpa ? ' · GPA hidden' : ''}
                                                                    </p>
                                                                </div>
                                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                                    {program.semesters.length} sem · {programCourseCount} courses
                                                                </span>
                                                            </button>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent>
                                                            <div className="ml-6 border-l border-dashed pl-2">
                                                                {program.semesters.length === 0 && (
                                                                    <p className="px-2 py-2 text-xs text-muted-foreground">No semesters</p>
                                                                )}
                                                                {program.semesters.map((semester, semesterIndex) => (
                                                                    <Collapsible
                                                                        key={`${program.name}-${semester.name}-${semesterIndex}`}
                                                                        className="group/semester"
                                                                    >
                                                                        <CollapsibleTrigger asChild>
                                                                            <button
                                                                                type="button"
                                                                                className="flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-muted/30"
                                                                            >
                                                                                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/semester:rotate-90" />
                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="truncate text-sm font-medium">{semester.name}</p>
                                                                                    <p className="truncate text-xs text-muted-foreground">
                                                                                        Avg {semester.average_scaled} ({semester.average_percentage}%) · Widgets {semester.widgets.length} · Tabs {semester.tabs.length}
                                                                                    </p>
                                                                                </div>
                                                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                                                    {semester.courses.length} courses
                                                                                </span>
                                                                            </button>
                                                                        </CollapsibleTrigger>
                                                                        <CollapsibleContent>
                                                                            <ul className="ml-5 border-l border-dashed py-1 pl-2">
                                                                                {semester.courses.length === 0 && (
                                                                                    <li className="px-2 py-1 text-xs text-muted-foreground">No courses</li>
                                                                                )}
                                                                                {semester.courses.map((course, courseIndex) => (
                                                                                    <li
                                                                                        key={`${semester.name}-${course.name}-${courseIndex}`}
                                                                                        className="px-2 py-1.5"
                                                                                    >
                                                                                        <p className="truncate text-xs font-medium">{course.name}</p>
                                                                                        <p className="truncate text-[11px] text-muted-foreground">
                                                                                            {course.alias ? `${course.alias} · ` : ''}
                                                                                            {course.credits} credits · {course.grade_percentage}% ({course.grade_scaled}) · Widgets {course.widgets.length} · Tabs {course.tabs.length}
                                                                                            {course.include_in_gpa ? ' · Include GPA' : ' · Exclude GPA'}
                                                                                            {course.hide_gpa ? ' · GPA hidden' : ''}
                                                                                        </p>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </CollapsibleContent>
                                                                    </Collapsible>
                                                                ))}
                                                            </div>
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                );
                                            })}
                                            {!hasPrograms && (
                                                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                                    No programs found.
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </Card>
                            </div>

                            {(analysis.conflictPrograms.length > 0 || hasImportSettings) && (
                                <div className="space-y-3">
                                    {analysis.conflictPrograms.length > 0 && (
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Conflict mode
                                            </h3>
                                            <RadioGroup
                                                value={conflictMode}
                                                onValueChange={(value) => setConflictMode(value as ConflictMode)}
                                                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                                            >
                                                {conflictOptions.map((option, index) => {
                                                    const id = `${radioBaseId}-${index}`;
                                                    const isChecked = conflictMode === option.value;
                                                    return (
                                                        <label
                                                            key={option.value}
                                                            htmlFor={id}
                                                            className={cn(
                                                                'cursor-pointer rounded-lg border p-3 transition-colors',
                                                                isChecked
                                                                    ? 'border-primary bg-primary/5'
                                                                    : 'border-muted hover:bg-accent/50'
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <RadioGroupItem value={option.value} id={id} />
                                                                <span className={cn('text-sm font-medium', isChecked && 'text-primary')}>
                                                                    {option.label}
                                                                </span>
                                                            </div>
                                                            <p className="pl-6 pt-1 text-xs text-muted-foreground">{option.description}</p>
                                                        </label>
                                                    );
                                                })}
                                            </RadioGroup>
                                        </div>
                                    )}

                                    {analysis.conflictPrograms.length > 0 && <Separator />}

                                    <div className="space-y-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            Account settings
                                        </h3>
                                        <div className="rounded-lg border border-dashed bg-muted/20 p-3">
                                            <div className="flex items-start gap-2.5">
                                                <Checkbox
                                                    id={includeSettingsId}
                                                    checked={hasImportSettings ? includeSettings : false}
                                                    disabled={!hasImportSettings}
                                                    onCheckedChange={(checked) => {
                                                        if (checked === 'indeterminate') return;
                                                        setIncludeSettings(checked);
                                                    }}
                                                    className="mt-0.5"
                                                />
                                                <div className="space-y-1">
                                                    <Label
                                                        htmlFor={includeSettingsId}
                                                        className={cn(
                                                            'flex items-center gap-1.5 text-sm font-medium',
                                                            hasImportSettings ? 'cursor-pointer' : 'cursor-not-allowed text-muted-foreground'
                                                        )}
                                                    >
                                                        <Settings2 className="size-3.5" />
                                                        Import account settings
                                                    </Label>
                                                    {!hasImportSettings && (
                                                        <p className="text-xs text-muted-foreground">
                                                            No account settings found in this backup.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                    </div>
                </div>

                <DialogFooter className="border-t bg-muted/20 px-5 py-3 sm:justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        disabled={isImporting}
                        className="h-8 px-4 text-xs"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleConfirm}
                        disabled={isImporting || !hasPrograms}
                        className="h-8 px-4 text-xs"
                    >
                        {isImporting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                        {isImporting ? 'Importing...' : 'Confirm Import'}
                        {!isImporting && <ArrowRight className="ml-2 size-3.5" />}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
