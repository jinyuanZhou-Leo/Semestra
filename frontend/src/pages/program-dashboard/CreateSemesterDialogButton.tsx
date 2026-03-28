// input:  [program id, semester refresh callback, dialog alert helper, Program LMS/course APIs, responsive dialog-drawer shell, shared LMS course selection list, and shadcn button/card/form tabs primitives]
// output: [`CreateSemesterDialogButton` for empty, calendar, and LMS-backed semester creation flows]
// pos:    [Program dashboard subcomponent that owns the add-semester dialog state, import mode switching, ICS upload handling, and LMS course selection UX]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { LmsCourseSelectionList } from '@/components/LmsCourseSelectionList';
import { ResponsiveDialogDrawer } from '@/components/ResponsiveDialogDrawer';
import api, { type Course } from '@/services/api';

type ShowAlert = (options: { title: string; description: string }) => Promise<void>;

export type CreateSemesterDialogButtonProps = {
    programId: string;
    onCreated: () => Promise<void>;
    showAlert: ShowAlert;
    className?: string;
    size?: React.ComponentProps<typeof Button>['size'];
    variant?: React.ComponentProps<typeof Button>['variant'];
    children: React.ReactNode;
};

export const CreateSemesterDialogButton: React.FC<CreateSemesterDialogButtonProps> = ({
    programId,
    onCreated,
    showAlert,
    className,
    size,
    variant,
    children,
}) => {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'create' | 'calendar' | 'lms'>('create');
    const [newSemesterName, setNewSemesterName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [programHasLms, setProgramHasLms] = useState(false);
    const [availableLmsCourses, setAvailableLmsCourses] = useState<Array<{ external_id: string; name: string; course_code?: string | null }>>([]);
    const [programCourses, setProgramCourses] = useState<Course[]>([]);
    const [selectedLmsCourseIds, setSelectedLmsCourseIds] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const createSemesterFormId = useId();
    const semesterNameId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        let active = true;
        api.getProgram(programId)
            .then(async (program) => {
                if (!active) return;
                const hasLms = Boolean(program.lms_integration_id);
                setProgramHasLms(hasLms);
                if (!hasLms) {
                    setAvailableLmsCourses([]);
                    return;
                }
                const courses = await api.getCoursesForProgram(programId);
                if (!active) return;
                setProgramCourses(courses);
                const response = await api.listProgramLmsCourses(programId, { page: 1, page_size: 100 });
                if (!active) return;
                setAvailableLmsCourses(response.items);
            })
            .catch(() => {
                if (!active) return;
                setProgramHasLms(false);
                setAvailableLmsCourses([]);
                setProgramCourses([]);
            });
        return () => {
            active = false;
        };
    }, [open, programId]);

    useEffect(() => {
        if (!open) {
            setMode('create');
        }
    }, [open]);

    const buildImportSummary = useCallback((results: Array<{ external_course_id: string; status: string; error?: { message?: string | null } | null }>) => {
        const created = results.filter((item) => item.status === 'created');
        const conflicts = results.filter((item) => item.status === 'conflict');
        const skipped = results.filter((item) => item.status === 'skipped');
        const lines = [
            `Created: ${created.length}`,
            conflicts.length > 0 ? `Conflicts: ${conflicts.length}` : null,
            skipped.length > 0 ? `Skipped: ${skipped.length}` : null,
        ].filter(Boolean) as string[];

        if (conflicts.length > 0) {
            lines.push('', 'Conflicts:');
            conflicts.forEach((item) => {
                lines.push(`- ${item.error?.message || item.external_course_id}`);
            });
        }

        return {
            createdCount: created.length,
            conflictCount: conflicts.length,
            skippedCount: skipped.length,
            description: lines.join('\n'),
        };
    }, []);

    const submitCreateSemester = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (mode === 'calendar') {
                if (!selectedFile) {
                    await showAlert({
                        title: 'Select a calendar file',
                        description: 'Upload an .ics file before creating a semester from calendar.',
                    });
                    return;
                }
                await api.uploadSemesterICS(programId, selectedFile, newSemesterName || undefined);
            } else if (mode === 'lms') {
                if (selectedLmsCourseIds.length === 0) {
                    await showAlert({
                        title: 'Select LMS courses',
                        description: 'Choose at least one LMS course before importing a semester from LMS.',
                    });
                    return;
                }
                const response = await api.importProgramLmsSemester(programId, {
                    name: newSemesterName,
                    external_course_ids: selectedLmsCourseIds,
                });
                const summary = buildImportSummary(response.courses.results);
                if (summary.conflictCount > 0 || summary.skippedCount > 0) {
                    await showAlert({
                        title: summary.createdCount > 0 ? 'Semester created with conflicts' : 'Semester created',
                        description: summary.description,
                    });
                }
            } else {
                await api.createSemester(programId, {
                    name: newSemesterName,
                });
            }
            setOpen(false);
            setMode('create');
            setNewSemesterName('');
            setSelectedFile(null);
            setSelectedLmsCourseIds([]);
            await onCreated();
        } catch (error) {
            console.error('Failed to create semester', error);
            await showAlert({
                title: 'Create failed',
                description: 'Failed to create semester.',
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [buildImportSummary, mode, newSemesterName, onCreated, programId, selectedFile, selectedLmsCourseIds, showAlert]);

    const syncFileSelection = useCallback(async (file: File | null) => {
        if (!file) return;
        if (file.name.endsWith('.ics') || file.type === 'text/calendar') {
            setSelectedFile(file);
            setSelectedLmsCourseIds([]);
            if (!newSemesterName) {
                const name = file.name.replace('.ics', '').replace(/[_-]/g, ' ');
                setNewSemesterName(name);
            }
            return;
        }
        await showAlert({
            title: 'Invalid file',
            description: 'Please upload a valid .ics file.',
        });
    }, [newSemesterName, showAlert]);

    const handleLmsSelectionChange = useCallback((courseIds: string[]) => {
        setSelectedLmsCourseIds(courseIds);
        if (courseIds.length > 0) {
            setSelectedFile(null);
        }
    }, []);

    const linkedLmsCourseReasons = useMemo<Record<string, string>>(() => {
        return programCourses.reduce<Record<string, string>>((accumulator, course) => {
            const externalCourseId = course.lms_link?.external_course_id;
            if (!externalCourseId) {
                return accumulator;
            }
            const localName = course.alias?.trim() ? `${course.name} (${course.alias.trim()})` : course.name;
            accumulator[externalCourseId] = `Already linked to ${localName}.`;
            return accumulator;
        }, {});
    }, [programCourses]);

    return (
        <>
            <Button
                type="button"
                size={size}
                variant={variant}
                className={className}
                onClick={(e) => {
                    e.currentTarget.blur();
                    setOpen(true);
                }}
            >
                {children}
            </Button>
            <ResponsiveDialogDrawer
                open={open}
                onOpenChange={(nextOpen) => {
                    setOpen(nextOpen);
                    if (!nextOpen) {
                        setMode('create');
                    }
                }}
                title="Create New Semester"
                description="Create or import a semester."
                desktopContentClassName="gap-0 p-0 sm:max-w-[640px] h-[85vh] max-h-[44rem] flex flex-col overflow-hidden"
                mobileContentClassName="gap-0 p-0 h-[85vh] max-h-[85vh] flex flex-col overflow-hidden"
                desktopHeaderClassName="border-b px-6 pt-6 pb-4 flex-none"
                mobileHeaderClassName="border-b px-6 pt-6 pb-4 flex-none text-left"
                footer={(
                    <>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form={createSemesterFormId} disabled={isSubmitting}>
                            {isSubmitting
                                ? 'Creating...'
                                : mode === 'calendar'
                                    ? 'Upload & Create'
                                    : mode === 'lms'
                                        ? 'Import & Create'
                                        : 'Create Semester'}
                        </Button>
                    </>
                )}
                desktopFooterClassName="px-6 pb-6 pt-4 border-t flex-none"
                mobileFooterClassName="pt-2 border-t flex-none"
            >
                <form
                    id={createSemesterFormId}
                    onSubmit={submitCreateSemester}
                    className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6"
                >
                    <Tabs
                        value={mode}
                        onValueChange={(value) => {
                            const nextMode = value as 'create' | 'calendar' | 'lms';
                            setMode(nextMode);
                            if (nextMode === 'create') {
                                setSelectedFile(null);
                                setSelectedLmsCourseIds([]);
                            }
                            if (nextMode === 'calendar') {
                                setSelectedLmsCourseIds([]);
                            }
                            if (nextMode === 'lms') {
                                setSelectedFile(null);
                            }
                        }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="flex-none">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="create">Create Empty</TabsTrigger>
                                <TabsTrigger value="calendar">From Calendar</TabsTrigger>
                                <TabsTrigger value="lms">From LMS</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="create" className="mt-4 min-h-0 flex-1">
                            <div className="flex h-full min-h-0 flex-col">
                                <Card className="border-border/70 shadow-none">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Empty Semester</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor={semesterNameId}>Semester Name</Label>
                                            <Input
                                                id={semesterNameId}
                                                placeholder="e.g. Fall 2025"
                                                value={newSemesterName}
                                                onChange={(e) => setNewSemesterName(e.target.value)}
                                                required={mode === 'create'}
                                                autoFocus
                                            />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Start with an empty semester and add courses or schedule data later.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="calendar" className="mt-4 min-h-0 flex-1">
                            <div className="flex h-full min-h-0 flex-col gap-4">
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor={`${semesterNameId}-calendar`}>Semester Name</Label>
                                        <Input
                                            id={`${semesterNameId}-calendar`}
                                            placeholder="e.g. Fall 2025"
                                            value={newSemesterName}
                                            onChange={(e) => setNewSemesterName(e.target.value)}
                                            required={mode === 'calendar' && !selectedFile}
                                        />
                                    </div>
                                    <div className="grid gap-3">
                                        <Label>ICS File</Label>
                                        <div
                                            className={`
                                                rounded-2xl border-2 border-dashed p-6 text-center transition-all
                                                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                                            `}
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setIsDragging(true);
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                setIsDragging(false);
                                            }}
                                            onDrop={async (e) => {
                                                e.preventDefault();
                                                setIsDragging(false);
                                                const file = e.dataTransfer.files?.[0] ?? null;
                                                await syncFileSelection(file);
                                            }}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".ics"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0] ?? null;
                                                    await syncFileSelection(file);
                                                }}
                                            />
                                            <div className="flex flex-col items-center gap-2">
                                                {selectedFile ? (
                                                    <div className="flex items-center gap-2 font-medium text-primary">
                                                        <Upload className="h-5 w-5" />
                                                        {selectedFile.name}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                                                        <div className="text-sm text-muted-foreground">
                                                            Click or drag an .ics file to upload
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Importing from calendar creates the semester first, then attaches the uploaded schedule.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="lms" className="mt-4 min-h-0 flex-1">
                            <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor={`${semesterNameId}-lms`}>Semester Name</Label>
                                        <Input
                                            id={`${semesterNameId}-lms`}
                                            placeholder="e.g. Fall 2025"
                                            value={newSemesterName}
                                            onChange={(e) => setNewSemesterName(e.target.value)}
                                            required={mode === 'lms'}
                                        />
                                    </div>

                                    {programHasLms ? (
                                        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                                            <Label className="mb-2">Select LMS Courses</Label>
                                            <LmsCourseSelectionList
                                                className="min-h-0 min-w-0 flex-1"
                                                courses={availableLmsCourses}
                                                selectedCourseIds={selectedLmsCourseIds}
                                                onSelectionChange={handleLmsSelectionChange}
                                                disabledCourseReasons={linkedLmsCourseReasons}
                                                noResultsDescription="Try a different keyword or year for LMS courses."
                                            />
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                            No LMS courses are available for this Program yet.
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    LMS import creates the semester first, then imports the selected LMS courses directly into it.
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </form>
            </ResponsiveDialogDrawer>
        </>
    );
};
