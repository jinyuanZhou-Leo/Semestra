// input:  [program/semester identifiers, course CRUD and LMS/calendar import APIs, auth default credit, dialog state, global confirm/alert dialogs, responsive overlay wrapper, shared LMS course picker, shared GPA-percentage formatting, and business empty-state wrappers]
// output: [`CourseManagerModal` component]
// pos:    [Program dashboard responsive add-course surface with height-stable select/create/calendar/LMS flows, searchable existing-course selection, duplicate-name confirmation, reusable LMS course selection, and import feedback]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppEmptyState } from '@/components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api, { type Course, type LmsCourseSummary } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { Plus, Search, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGpaPercentage } from '@/utils/percentage';
import { ResponsiveDialogDrawer } from './ResponsiveDialogDrawer';
import { LmsCourseSelectionList } from './LmsCourseSelectionList';

interface CourseManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    programId: string;
    semesterId?: string;
    onCourseAdded: () => void;
}

export const CourseManagerModal: React.FC<CourseManagerModalProps> = ({
    isOpen,
    onClose,
    programId,
    semesterId,
    onCourseAdded
}) => {
    const { user } = useAuth();
    const { alert: showAlert, confirm } = useDialog();
    const defaultCredit = (user?.default_course_credit ?? 0.5).toString();

    const [mode, setMode] = useState<'list' | 'create' | 'calendar' | 'import'>(semesterId ? 'list' : 'create');
    const [unassignedCourses, setUnassignedCourses] = useState<Course[]>([]);
    const [programCourses, setProgramCourses] = useState<Course[]>([]);
    const [availableLmsCourses, setAvailableLmsCourses] = useState<LmsCourseSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isCalendarImporting, setIsCalendarImporting] = useState(false);
    const [programHasLms, setProgramHasLms] = useState(false);
    const [selectedLmsCourseIds, setSelectedLmsCourseIds] = useState<string[]>([]);
    const [selectedCalendarFile, setSelectedCalendarFile] = useState<File | null>(null);
    const [isDraggingCalendar, setIsDraggingCalendar] = useState(false);
    const [existingCourseSearchQuery, setExistingCourseSearchQuery] = useState('');
    const calendarFileInputRef = useRef<HTMLInputElement>(null);

    // Create Form State
    const [newName, setNewName] = useState('');
    const [newAlias, setNewAlias] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newCredits, setNewCredits] = useState(defaultCredit);
    const [newGrade, setNewGrade] = useState('0');

    const fetchUnassigned = useCallback(async () => {
        setIsLoading(true);
        try {
            const courses = await api.getCoursesForProgram(programId, { unassigned: true });
            setUnassignedCourses(courses);
        } catch (error) {
            console.error("Failed to fetch unassigned courses", error);
        } finally {
            setIsLoading(false);
        }
    }, [programId]);

    const fetchProgramCourses = useCallback(async () => {
        try {
            const courses = await api.getCoursesForProgram(programId);
            setProgramCourses(courses);
        } catch (error) {
            console.error('Failed to fetch program courses', error);
            setProgramCourses([]);
        }
    }, [programId]);

    const fetchProgramLmsCourses = useCallback(async () => {
        try {
            const program = await api.getProgram(programId);
            const hasIntegration = Boolean(program.lms_integration_id);
            setProgramHasLms(hasIntegration);
            if (!hasIntegration) {
                setAvailableLmsCourses([]);
                return;
            }
            const response = await api.listProgramLmsCourses(programId, { page: 1, page_size: 100 });
            setAvailableLmsCourses(response.items);
        } catch (error) {
            console.error('Failed to fetch LMS courses', error);
            setProgramHasLms(false);
            setAvailableLmsCourses([]);
        }
    }, [programId]);

    useEffect(() => {
        if (isOpen) {
            setNewCredits(defaultCredit);
            setSelectedLmsCourseIds([]);
            setSelectedCalendarFile(null);
            setExistingCourseSearchQuery('');
            void fetchProgramCourses();
            void fetchProgramLmsCourses();
            if (semesterId) {
                // If opening in a semester, default to list but fetch data
                setMode('list');
                fetchUnassigned();
            } else {
                // If just creating (e.g. from program dashboard), direct to create
                setMode('create');
            }
        }
    }, [isOpen, semesterId, fetchProgramCourses, fetchUnassigned, fetchProgramLmsCourses, defaultCredit]);

    const findDuplicateCourses = useCallback((name: string) => {
        const normalizedName = name.trim().toLowerCase();
        if (!normalizedName) {
            return [];
        }
        return programCourses.filter((course) => course.name.trim().toLowerCase() === normalizedName);
    }, [programCourses]);

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

    const handleAddExisting = async (courseId: string) => {
        try {
            await api.updateCourse(courseId, { semester_id: semesterId });
            onCourseAdded();
            fetchUnassigned(); // Refresh list
        } catch (error) {
            console.error("Failed to add course to semester", error);
        }
    };

    const handleCreateNew = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const duplicateCourses = findDuplicateCourses(newName);
            if (duplicateCourses.length > 0) {
                const duplicateSummary = duplicateCourses
                    .map((course) => {
                        if (!course.semester_id) {
                            return `${course.name} (Unassigned)`;
                        }
                        return course.alias ? `${course.name} (${course.alias})` : course.name;
                    })
                    .join('\n');
                const shouldContinue = await confirm({
                    title: 'Duplicate course name found',
                    description: `A course named "${newName.trim()}" already exists in this Program.\n\nExisting matches:\n${duplicateSummary}\n\nDo you still want to create another course with the same name?`,
                    confirmText: 'Create Anyway',
                    cancelText: 'Cancel',
                });
                if (!shouldContinue) {
                    return;
                }
            }

            const courseData = {
                name: newName,
                alias: newAlias || undefined,
                category: newCategory || undefined,
                credits: parseFloat(newCredits),
                grade_percentage: parseFloat(newGrade),
                program_id: programId
            };
            if (semesterId) {
                await api.createCourse(semesterId, courseData);
            } else {
                await api.createCourseForProgram(programId, courseData);
            }
            onCourseAdded();
            if (semesterId) {
                setMode('list');
                fetchUnassigned();
            } else {
                onClose();
            }
            setNewName('');
            setNewAlias('');
            setNewCategory('');
            setNewCredits(defaultCredit);
            setNewGrade('0');
        } catch (error) {
            console.error("Failed to create course", error);
            await showAlert({
                title: 'Create failed',
                description: 'Failed to create course.',
            });
        }
    }, [confirm, defaultCredit, findDuplicateCourses, newAlias, newCategory, newCredits, newGrade, newName, onClose, onCourseAdded, programId, semesterId, showAlert, fetchUnassigned]);

    const handleImportFromLms = useCallback(async () => {
        if (selectedLmsCourseIds.length === 0) return;
        setIsImporting(true);
        try {
            const response = await api.importProgramLmsCourses(programId, {
                external_course_ids: selectedLmsCourseIds,
                semester_id: semesterId,
            });
            await onCourseAdded();
            setSelectedLmsCourseIds([]);
            await fetchProgramLmsCourses();
            await fetchProgramCourses();
            if (semesterId) {
                await fetchUnassigned();
            }

            const summary = buildImportSummary(response.results);
            if (summary.conflictCount > 0 || summary.skippedCount > 0) {
                await showAlert({
                    title: summary.createdCount > 0 ? 'Import completed with conflicts' : 'Import blocked',
                    description: summary.description,
                });
            } else if (!semesterId) {
                onClose();
            } else {
                await showAlert({
                    title: 'Import completed',
                    description: summary.description,
                });
            }
        } catch (error) {
            console.error('Failed to import LMS courses', error);
            await showAlert({
                title: 'Import failed',
                description: 'Failed to import LMS courses.',
            });
        } finally {
            setIsImporting(false);
        }
    }, [buildImportSummary, fetchProgramCourses, fetchProgramLmsCourses, fetchUnassigned, onClose, onCourseAdded, programId, selectedLmsCourseIds, semesterId, showAlert]);

    const syncCalendarFileSelection = useCallback((file: File | null) => {
        if (!file) return false;
        if (file.name.endsWith('.ics') || file.type === 'text/calendar') {
            setSelectedCalendarFile(file);
            setSelectedLmsCourseIds([]);
            return true;
        }
        return false;
    }, []);

    const handleImportFromCalendar = async () => {
        if (!selectedCalendarFile) return;
        setIsCalendarImporting(true);
        try {
            await api.uploadProgramCourseICS(programId, selectedCalendarFile, semesterId);
            await onCourseAdded();
            setSelectedCalendarFile(null);
            if (semesterId) {
                await fetchUnassigned();
            } else {
                onClose();
            }
        } catch (error) {
            console.error('Failed to import ICS courses', error);
            await showAlert({
                title: 'Import failed',
                description: 'Failed to import courses from calendar.',
            });
        } finally {
            setIsCalendarImporting(false);
        }
    };

    const filteredUnassignedCourses = useMemo(() => {
        const normalizedQuery = existingCourseSearchQuery.trim().toLowerCase();
        if (!normalizedQuery) {
            return unassignedCourses;
        }

        return unassignedCourses.filter((course) => {
            const haystack = [
                course.name,
                course.alias ?? '',
                course.category ?? '',
                String(course.credits),
                String(course.grade_percentage),
            ].join(' ').toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }, [existingCourseSearchQuery, unassignedCourses]);

    const dialogTitle = semesterId ? 'Manage Courses' : 'Add Course';
    const dialogDescription = semesterId
        ? 'Add an existing course to the semester, create a new course, or import from calendar/LMS.'
        : 'Create a new course in this program or import from calendar/LMS.';
    const desktopContentClassName = "p-0 flex h-[85vh] max-h-[44rem] flex-col overflow-hidden sm:max-w-[640px]";
    const mobileContentClassName = "p-0 flex h-[85vh] max-h-[85vh] flex-col overflow-hidden";
    const surfaceBodyClassName = "flex min-h-0 flex-1 flex-col p-4";
    const headerTitleClassName = "text-base font-semibold";

    const modalBody = (
        <div className={surfaceBodyClassName}>
            <Tabs
                value={mode}
                onValueChange={(value) => {
                    const nextMode = value as 'list' | 'create' | 'calendar' | 'import';
                    setMode(nextMode);
                    if (nextMode !== 'import') {
                        setSelectedLmsCourseIds([]);
                    }
                    if (nextMode !== 'calendar') {
                        setSelectedCalendarFile(null);
                    }
                }}
                className="flex min-h-0 flex-1 flex-col"
            >
                <div className="flex-none">
                    <TabsList className={cn(
                        "grid w-full",
                        semesterId && programHasLms ? "grid-cols-4" :
                        semesterId || programHasLms ? "grid-cols-3" :
                        "grid-cols-2"
                    )}>
                        {semesterId ? (
                            <TabsTrigger value="list">
                                Select Existing
                            </TabsTrigger>
                        ) : null}
                        <TabsTrigger value="create">
                            Create New
                        </TabsTrigger>
                        <TabsTrigger value="calendar">
                            From Calendar
                        </TabsTrigger>
                        {programHasLms ? (
                            <TabsTrigger value="import">
                                Import From LMS
                            </TabsTrigger>
                        ) : null}
                    </TabsList>
                </div>

                <TabsContent value="list" className="mt-4 min-h-0 flex-1">
                    {semesterId ? (
                        <div className="flex h-full min-h-0 flex-col gap-4">
                            <div className="relative flex-none">
                                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={existingCourseSearchQuery}
                                    onChange={(event) => setExistingCourseSearchQuery(event.target.value)}
                                    placeholder="Search existing courses..."
                                    className="pl-9"
                                />
                            </div>
                            <div className="min-h-0 min-w-0 flex-1 rounded-md border border-border/70 bg-muted/15 p-3">
                                {isLoading ? (
                                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-muted/30 px-5 py-9 text-center">
                                        <Spinner className="size-5 text-muted-foreground" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-foreground">Loading courses</p>
                                            <p className="text-sm text-muted-foreground">Fetching unassigned courses.</p>
                                        </div>
                                    </div>
                                ) : unassignedCourses.length === 0 ? (
                                    <AppEmptyState
                                        scenario="no-results"
                                        size="modal"
                                        title="No courses found"
                                        description="All courses are already assigned to semesters."
                                    />
                                ) : filteredUnassignedCourses.length === 0 ? (
                                    <AppEmptyState
                                        scenario="no-results"
                                        size="modal"
                                        title="No matching courses"
                                        description="Try a different keyword."
                                    />
                                ) : (
                                    <ScrollArea className="h-full min-h-0 min-w-0 [&>[data-slot=scroll-area-viewport]]:overflow-x-hidden [&>[data-slot=scroll-area-viewport]>div]:!block [&>[data-slot=scroll-area-viewport]>div]:min-h-full [&>[data-slot=scroll-area-viewport]>div]:w-full [&>[data-slot=scroll-area-viewport]>div]:min-w-0">
                                        <div className="w-full min-w-0 max-w-full space-y-2 pr-3">
                                            {filteredUnassignedCourses.map(course => (
                                                <div key={course.id} className={cn(
                                                    "flex items-start justify-between gap-3 rounded-md border bg-card p-4 transition-colors",
                                                    "hover:border-primary/40 hover:bg-accent/40"
                                                )}>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-1 truncate font-semibold">{course.name}</div>
                                                        {course.alias && (
                                                            <div className="mb-1 truncate text-xs text-muted-foreground">
                                                                {course.alias}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <span className="opacity-70">Credits:</span> {course.credits}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="opacity-70">Grade:</span> {formatGpaPercentage(course.grade_percentage)}
                                                            </span>
                                                            {course.category ? (
                                                                <span className="flex items-center gap-1">
                                                                    <span className="opacity-70">Category:</span> {course.category}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleAddExisting(course.id)}
                                                        className="shrink-0"
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </div>
                        </div>
                    ) : null}
                </TabsContent>

                <TabsContent value="create" className="mt-4 min-h-0 flex-1">
                    <form
                        onSubmit={handleCreateNew}
                        className="flex h-full min-h-0 flex-col gap-4"
                    >
                        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pr-1">
                            <div className="grid gap-2">
                                <Label htmlFor="course-name">Course Name</Label>
                                <Input
                                    id="course-name"
                                    value={newName}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setNewName(val);
                                        if (!newCategory) {
                                            const match = val.trim().match(/^([A-Za-z]{2,4})\d/);
                                            if (match) {
                                                setNewCategory(match[1].toUpperCase());
                                            }
                                        }
                                    }}
                                    required
                                    placeholder="e.g. Introduction to Computer Science"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="course-category">Category</Label>
                                <Input
                                    id="course-category"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    placeholder="e.g. CS (Auto-detected from Name)"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="course-alias">Alias (optional)</Label>
                                <Input
                                    id="course-alias"
                                    value={newAlias}
                                    onChange={e => setNewAlias(e.target.value)}
                                    placeholder="e.g. CS101 - Prof. Smith"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="course-credits">Credits</Label>
                                    <Input
                                        id="course-credits"
                                        type="number"
                                        step="0.5"
                                        value={newCredits}
                                        onChange={e => setNewCredits(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="course-grade">Grade (%)</Label>
                                    <Input
                                        id="course-grade"
                                        type="number"
                                        step="0.1"
                                        value={newGrade}
                                        onChange={e => setNewGrade(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto border-t pt-4">
                            <Button type="submit" className="w-full">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Course
                            </Button>
                        </div>
                    </form>
                </TabsContent>

                <TabsContent value="calendar" className="mt-4 min-h-0 flex-1">
                    <div className="flex h-full min-h-0 flex-col gap-4">
                        <div className="grid gap-3">
                            <Label>ICS File</Label>
                            <div
                                className={cn(
                                    "rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                                    isDraggingCalendar ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                                )}
                                onClick={() => calendarFileInputRef.current?.click()}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDraggingCalendar(true);
                                }}
                                onDragLeave={(event) => {
                                    event.preventDefault();
                                    setIsDraggingCalendar(false);
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setIsDraggingCalendar(false);
                                    const file = event.dataTransfer.files?.[0] ?? null;
                                    syncCalendarFileSelection(file);
                                }}
                            >
                                <input
                                    ref={calendarFileInputRef}
                                    type="file"
                                    accept=".ics"
                                    className="hidden"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        syncCalendarFileSelection(file);
                                    }}
                                />
                                <div className="flex flex-col items-center gap-2">
                                    {selectedCalendarFile ? (
                                        <div className="flex items-center gap-2 font-medium text-primary">
                                            <Upload className="h-5 w-5" />
                                            {selectedCalendarFile.name}
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-muted-foreground/50" />
                                            <div className="text-sm text-muted-foreground">
                                                Click or drag an .ics file to parse courses
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            ICS import will parse course names from the calendar and create them in this Program{semesterId ? ' and add them to the current Semester' : ''}.
                        </div>

                        <div className="mt-auto border-t pt-4">
                            <Button
                                type="button"
                                className="w-full"
                                disabled={!selectedCalendarFile || isCalendarImporting}
                                onClick={() => void handleImportFromCalendar()}
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                {isCalendarImporting ? 'Importing...' : 'Import Courses From Calendar'}
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="import" className="mt-4 min-h-0 flex-1">
                    <div className="flex h-full min-h-0 flex-col">
                        <LmsCourseSelectionList
                            courses={availableLmsCourses}
                            selectedCourseIds={selectedLmsCourseIds}
                            onSelectionChange={setSelectedLmsCourseIds}
                            disabledCourseReasons={linkedLmsCourseReasons}
                        />
                        <div className="mt-4 border-t pt-4">
                            <Button
                                type="button"
                                className="w-full"
                                disabled={selectedLmsCourseIds.length === 0 || isImporting}
                                onClick={() => void handleImportFromLms()}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                {isImporting ? 'Importing...' : `Import ${selectedLmsCourseIds.length || ''} LMS Course${selectedLmsCourseIds.length === 1 ? '' : 's'}`}
                            </Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );

    return (
        <ResponsiveDialogDrawer
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            title={dialogTitle}
            description={dialogDescription}
            titleClassName={headerTitleClassName}
            descriptionClassName="sr-only"
            desktopContentClassName={desktopContentClassName}
            mobileContentClassName={mobileContentClassName}
            desktopHeaderClassName="border-b px-6 py-4 flex-none"
            mobileHeaderClassName="border-b px-6 py-4 flex-none"
        >
            {modalBody}
        </ResponsiveDialogDrawer>
    );
};
