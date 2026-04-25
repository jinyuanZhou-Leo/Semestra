// input:  [raw backup payload, conflict strategy options, shared GPA-percentage formatting, optional account-settings import flag, confirm callbacks, and shadcn scroll-area]
// output: [`ImportPreviewModal` component and backup import helper types]
// pos:    [Settings workflow modal that previews backup contents across programs, LMS integrations, resources, todo data, and account settings before restore]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, ChevronRight, Loader2, Settings2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatGpaPercentage } from '@/utils/percentage';

type CountableList = Array<unknown> | undefined | null;

const countOf = (value: CountableList): number => value?.length ?? 0;

type ImportBackupCollection = unknown[];

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim().length > 0) {
            return message;
        }
    }

    return 'An unexpected error occurred during import.';
};

export interface CourseExport {
    id?: string;
    name: string;
    alias?: string;
    category?: string;
    color?: string | null;
    credits: number;
    grade_percentage: number;
    grade_scaled: number;
    include_in_gpa: boolean;
    widgets: ImportBackupCollection;
    tabs: ImportBackupCollection;
    gradebook?: unknown;
    resource_files?: Array<{ filename_display: string; resource_kind: string }>;
    lms_link?: { external_course_id: string; sync_enabled: boolean } | null;
    event_types?: ImportBackupCollection;
    sections?: ImportBackupCollection;
    events?: ImportBackupCollection;
}

export interface SemesterExport {
    id?: string;
    name: string;
    average_percentage: number;
    average_scaled: number;
    start_date?: string;
    end_date?: string;
    reading_week_start?: string | null;
    reading_week_end?: string | null;
    courses: CourseExport[];
    widgets: ImportBackupCollection;
    tabs: ImportBackupCollection;
    todo?: {
        sections?: Array<{ id?: string; name: string }>;
        tasks?: Array<{ id?: string; title: string }>;
    } | null;
}

export interface ProgramExport {
    id?: string;
    name: string;
    cgpa_scaled: number;
    cgpa_percentage: number;
    gpa_scaling_table?: string;
    grad_requirement_credits: number;
    hide_gpa: boolean;
    program_timezone?: string;
    lms_integration_id?: string | null;
    courses?: CourseExport[];
    semesters: SemesterExport[];
}

export interface LmsIntegrationExport {
    id?: string;
    display_name: string;
    provider: string;
    status?: string;
}

export interface ImportData {
    version?: string;
    exported_at?: string;
    settings?: {
        nickname?: string;
        gpa_scaling_table?: string;
        default_course_credit?: number;
        background_plugin_preload?: boolean;
    };
    lms_integrations?: LmsIntegrationExport[];
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
    { value: 'rename', label: 'Rename', description: 'Keep both' },
];

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
    isOpen,
    onClose,
    importData,
    existingProgramNames,
    onConfirm,
}) => {
    const [conflictMode, setConflictMode] = useState<ConflictMode>('skip');
    const [includeSettings, setIncludeSettings] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const radioBaseId = useId();
    const includeSettingsId = useId();

    const analysis = useMemo(() => {
        if (!importData) {
            return {
                newPrograms: [] as string[],
                conflictPrograms: [] as string[],
                totalSemesters: 0,
                totalCourses: 0,
                totalTodoTasks: 0,
                totalResources: 0,
                totalEvents: 0,
            };
        }

        const existingNamesLower = new Set(existingProgramNames.map((name) => name.toLowerCase()));
        const newPrograms: string[] = [];
        const conflictPrograms: string[] = [];
        let totalSemesters = 0;
        let totalCourses = 0;
        let totalTodoTasks = 0;
        let totalResources = 0;
        let totalEvents = 0;

        const accumulateCourse = (course: CourseExport) => {
            totalCourses += 1;
            totalResources += countOf(course.resource_files);
            totalEvents += countOf(course.events);
        };

        for (const program of importData.programs) {
            if (existingNamesLower.has(program.name.toLowerCase())) {
                conflictPrograms.push(program.name);
            } else {
                newPrograms.push(program.name);
            }

            for (const course of program.courses ?? []) {
                accumulateCourse(course);
            }

            totalSemesters += program.semesters.length;
            for (const semester of program.semesters) {
                totalTodoTasks += countOf(semester.todo?.tasks);
                for (const course of semester.courses) {
                    accumulateCourse(course);
                }
            }
        }

        return {
            newPrograms,
            conflictPrograms,
            totalSemesters,
            totalCourses,
            totalTodoTasks,
            totalResources,
            totalEvents,
        };
    }, [existingProgramNames, importData]);

    const conflictNameSet = useMemo(
        () => new Set(analysis.conflictPrograms.map((name) => name.toLowerCase())),
        [analysis.conflictPrograms],
    );

    const programs = importData?.programs ?? [];
    const integrations = importData?.lms_integrations ?? [];
    const programCount = programs.length;
    const integrationCount = integrations.length;
    const hasImportSettings = Boolean(importData?.settings);
    const hasImportableContent = programCount > 0 || integrationCount > 0 || hasImportSettings;
    const exportedAt = useMemo(() => {
        if (!importData?.exported_at) return null;
        const parsed = new Date(importData.exported_at);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toLocaleString();
    }, [importData?.exported_at]);

    const handleConfirm = async () => {
        if (!hasImportableContent) return;
        setIsImporting(true);
        try {
            await onConfirm(conflictMode, hasImportSettings ? includeSettings : false);
            toast.success('Import successful');
            onClose();
        } catch (error: unknown) {
            console.error('Import failed:', error);
            toast.error('Import failed', {
                description: getErrorMessage(error),
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
            <DialogContent className="sm:max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>Import Preview</DialogTitle>
                    <DialogDescription>
                        Review the backup contents, choose how to handle conflicts, and confirm the restore.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh]">
                    <div className="flex flex-col gap-4 px-1 pb-1">
                        <section className="flex flex-col gap-3 rounded-lg border p-4">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-sm font-medium">Backup summary</h3>
                                <p className="text-sm text-muted-foreground">
                                    Review the imported content before choosing how Semestra should restore it.
                                </p>
                            </div>
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
                                <Badge variant="secondary" className="h-5 bg-background px-2 text-[11px] text-foreground/90">
                                    LMS <span className="ml-1 font-semibold">{integrationCount}</span>
                                </Badge>
                                <Badge variant="secondary" className="h-5 bg-background px-2 text-[11px] text-foreground/90">
                                    Todo <span className="ml-1 font-semibold">{analysis.totalTodoTasks}</span>
                                </Badge>
                                <Badge variant="secondary" className="h-5 bg-background px-2 text-[11px] text-foreground/90">
                                    Resources <span className="ml-1 font-semibold">{analysis.totalResources}</span>
                                </Badge>
                                <Badge variant="secondary" className="h-5 bg-background px-2 text-[11px] text-foreground/90">
                                    Events <span className="ml-1 font-semibold">{analysis.totalEvents}</span>
                                </Badge>
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        'h-5 px-2 text-[11px]',
                                        analysis.conflictPrograms.length > 0
                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                            : 'bg-background text-foreground/90',
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
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                    {exportedAt && <span>Exported: {exportedAt}</span>}
                                    {importData.version && <span>Version: {importData.version}</span>}
                                </div>
                            )}
                        </section>

                        <section className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-lg font-semibold">Programs in this backup</h3>
                                <p className="text-sm text-muted-foreground">
                                    Review the program structure before confirming the restore.
                                </p>
                            </div>
                            <div className="overflow-hidden rounded-lg border">
                                <ScrollArea className="h-[320px]">
                                    <div className="divide-y divide-muted/40">
                                        {programs.map((program, programIndex) => {
                                            const isConflict = conflictNameSet.has(program.name.toLowerCase());
                                            const semesterCourseCount = program.semesters.reduce((total, semester) => total + semester.courses.length, 0);
                                            const programLevelCourseCount = countOf(program.courses);
                                            const programDetails = [
                                                `CGPA ${program.cgpa_scaled} (${formatGpaPercentage(program.cgpa_percentage)})`,
                                                `Grad Credits ${program.grad_requirement_credits}`,
                                                program.hide_gpa ? 'GPA hidden' : null,
                                            ].filter(Boolean);
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
                                                                                : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                                                                        )}
                                                                    >
                                                                        {isConflict ? 'Conflict' : 'New'}
                                                                    </Badge>
                                                                </div>
                                                                <p className="truncate text-xs text-muted-foreground">
                                                                    {programDetails.join(' · ')}
                                                                </p>
                                                            </div>
                                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                                {program.semesters.length} Semesters · {semesterCourseCount + programLevelCourseCount} Courses
                                                            </span>
                                                        </button>
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent>
                                                        <div className="ml-6 border-l border-dashed pl-2">
                                                            {programLevelCourseCount > 0 && (
                                                                <p className="px-2 py-2 text-xs text-muted-foreground">
                                                                    Program-level courses: {programLevelCourseCount}
                                                                </p>
                                                            )}
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
                                                                                    Avg {semester.average_scaled} ({formatGpaPercentage(semester.average_percentage)}) · {semester.widgets.length} Widgets · {semester.tabs.length} Tabs
                                                                                </p>
                                                                            </div>
                                                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                                                {semester.courses.length} Courses
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
                                                                                    <p className="truncate text-xs font-medium">
                                                                                        {course.name}
                                                                                        {course.alias ? ` ${course.alias}` : ''}
                                                                                    </p>
                                                                                    <p className="truncate text-[11px] text-muted-foreground">
                                                                                        {course.credits} Credits · {formatGpaPercentage(course.grade_percentage)} ({course.grade_scaled}) · {course.widgets.length} Widgets · {course.tabs.length} Tabs
                                                                                        {countOf(course.resource_files) > 0 ? ` · ${countOf(course.resource_files)} Resources` : ''}
                                                                                        {countOf(course.events) > 0 ? ` · ${countOf(course.events)} Events` : ''}
                                                                                        {course.lms_link ? ' · LMS linked' : ''}
                                                                                        {course.include_in_gpa ? ' · Include GPA' : ' · Exclude GPA'}
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
                                        {programCount === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No programs found.</div>}
                                    </div>
                                </ScrollArea>
                            </div>
                        </section>

                        {(analysis.conflictPrograms.length > 0 || hasImportSettings || integrationCount > 0) && (
                            <div className="flex flex-col gap-5">
                                {analysis.conflictPrograms.length > 0 && (
                                    <FieldSet>
                                        <FieldLegend variant="label">Conflict mode</FieldLegend>
                                        <FieldDescription>
                                            Choose how to handle programs that already exist in Semestra.
                                        </FieldDescription>
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
                                                            'flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                                                            isChecked
                                                                ? 'border-primary bg-primary/5'
                                                                : 'hover:bg-accent/50',
                                                        )}
                                                    >
                                                        <RadioGroupItem value={option.value} id={id} className="mt-0.5 shrink-0" />
                                                        <div className="min-w-0">
                                                            <div className={cn('text-sm font-medium', isChecked && 'text-primary')}>
                                                                {option.label}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {option.description}
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </RadioGroup>
                                    </FieldSet>
                                )}

                                {(analysis.conflictPrograms.length > 0 && (hasImportSettings || integrationCount > 0)) && <Separator />}

                                {integrationCount > 0 && (
                                    <Alert>
                                        <AlertCircle />
                                        <AlertTitle>LMS integrations</AlertTitle>
                                        <AlertDescription>
                                            {integrationCount} LMS integration{integrationCount === 1 ? '' : 's'} will also be restored.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <FieldSet>
                                    <FieldLegend variant="label">Account settings</FieldLegend>
                                    <Field
                                        orientation="horizontal"
                                        data-disabled={!hasImportSettings}
                                        className="rounded-lg border p-3"
                                    >
                                        <Checkbox
                                            id={includeSettingsId}
                                            checked={hasImportSettings ? includeSettings : false}
                                            disabled={!hasImportSettings}
                                            onCheckedChange={(checked) => {
                                                if (checked === 'indeterminate') return;
                                                setIncludeSettings(checked);
                                            }}
                                        />
                                            <FieldContent>
                                                <FieldLabel htmlFor={includeSettingsId} className={cn(!hasImportSettings && 'cursor-not-allowed')}>
                                                    <Settings2 className="size-3.5" />
                                                    Import account settings
                                                </FieldLabel>
                                            <FieldDescription>
                                                {hasImportSettings
                                                    ? 'Restore the exported account-level preferences together with the selected content.'
                                                    : 'No account settings were found in this backup.'}
                                            </FieldDescription>
                                        </FieldContent>
                                    </Field>
                                </FieldSet>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isImporting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isImporting || !hasImportableContent}
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
