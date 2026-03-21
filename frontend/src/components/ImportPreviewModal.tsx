// input:  [raw backup payload, conflict strategy options, shared GPA-percentage formatting, optional account-settings import flag, and confirm callbacks]
// output: [`ImportPreviewModal` component and backup import helper types]
// pos:    [Settings workflow modal that previews backup contents across programs, LMS integrations, resources, todo data, and account settings before restore]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, ChevronRight, FileDown, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatGpaPercentage } from '@/utils/percentage';

type CountableList = Array<unknown> | undefined | null;

const countOf = (value: CountableList): number => value?.length ?? 0;

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
    hide_gpa: boolean;
    widgets: any[];
    tabs: any[];
    plugin_settings?: any[];
    gradebook?: unknown;
    resource_files?: Array<{ filename_display: string; resource_kind: string }>;
    lms_link?: { external_course_id: string; sync_enabled: boolean } | null;
    event_types?: any[];
    sections?: any[];
    events?: any[];
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
    widgets: any[];
    tabs: any[];
    plugin_settings?: any[];
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
                                            const semesterCourseCount = program.semesters.reduce((total, semester) => total + semester.courses.length, 0);
                                            const programLevelCourseCount = countOf(program.courses);
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
                                                                    CGPA {program.cgpa_scaled} ({formatGpaPercentage(program.cgpa_percentage)}) · Grad Credits {program.grad_requirement_credits}
                                                                    {program.program_timezone ? ` · ${program.program_timezone}` : ''}
                                                                    {program.gpa_scaling_table ? ` · Scale ${program.gpa_scaling_table}` : ''}
                                                                    {program.hide_gpa ? ' · GPA hidden' : ''}
                                                                </p>
                                                            </div>
                                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                                {program.semesters.length} sem · {semesterCourseCount + programLevelCourseCount} courses
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
                                                                                    Avg {semester.average_scaled} ({formatGpaPercentage(semester.average_percentage)}) · Widgets {semester.widgets.length} · Tabs {semester.tabs.length}
                                                                                    {countOf(semester.todo?.tasks) > 0 ? ` · Todo ${countOf(semester.todo?.tasks)}` : ''}
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
                                                                                        {course.credits} credits · {formatGpaPercentage(course.grade_percentage)} ({course.grade_scaled}) · Widgets {course.widgets.length} · Tabs {course.tabs.length}
                                                                                        {countOf(course.resource_files) > 0 ? ` · Resources ${countOf(course.resource_files)}` : ''}
                                                                                        {countOf(course.events) > 0 ? ` · Events ${countOf(course.events)}` : ''}
                                                                                        {course.lms_link ? ' · LMS linked' : ''}
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
                                        {programCount === 0 && (
                                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                                No programs found.
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </Card>
                        </div>

                        {(analysis.conflictPrograms.length > 0 || hasImportSettings || integrationCount > 0) && (
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
                                                                : 'border-muted hover:bg-accent/50',
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

                                {(analysis.conflictPrograms.length > 0 && (hasImportSettings || integrationCount > 0)) && <Separator />}

                                {integrationCount > 0 && (
                                    <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                                        {integrationCount} LMS integration{integrationCount === 1 ? '' : 's'} will also be restored.
                                    </div>
                                )}

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
                                                        hasImportSettings ? 'cursor-pointer' : 'cursor-not-allowed text-muted-foreground',
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
                        disabled={isImporting || !hasImportableContent}
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
