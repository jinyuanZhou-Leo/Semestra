// input:  [program/semester identifiers, optional close-on-success preference, course CRUD and LMS/calendar import APIs, auth default credit, dialog state, global confirm/alert dialogs, responsive dialog/drawer wrapper, shared LMS course picker, shared GPA-percentage formatting, business empty-state wrappers, and shadcn field/input/error/scroll-area primitives]
// output: [`CourseManagerModal` component]
// pos:    [Program dashboard and Semester-wizard responsive add-course surface with reliable close-after-success behavior, doc-aligned responsive dialog/drawer composition, shared sticky footer actions, submit-driven field validation semantics, searchable existing-course selection, duplicate-name confirmation, reusable LMS course selection, and import feedback]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppEmptyState } from '@/components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api, { type Course, type LmsCourseSummary } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { Plus, Search, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGpaPercentage } from '@/utils/percentage';
import { ResponsiveDialogDrawer } from './ResponsiveDialogDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { LmsCourseSelectionList } from './LmsCourseSelectionList';

interface CourseManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    programId: string;
    semesterId?: string;
    closeOnSuccess?: boolean;
    onCourseAdded: () => void | Promise<void>;
}

export const CourseManagerModal: React.FC<CourseManagerModalProps> = ({
    isOpen,
    onClose,
    programId,
    semesterId,
    closeOnSuccess = false,
    onCourseAdded
}) => {
    const { user } = useAuth();
    const { alert: showAlert, confirm } = useDialog();
    const isMobile = useIsMobile();
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
    const [hasAttemptedCreateSubmit, setHasAttemptedCreateSubmit] = useState(false);

    const resetCreateDraft = useCallback(() => {
        setNewName('');
        setNewAlias('');
        setNewCategory('');
        setNewCredits(defaultCredit);
        setNewGrade('0');
        setHasAttemptedCreateSubmit(false);
    }, [defaultCredit]);

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
            setHasAttemptedCreateSubmit(false);
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

    const runPostSubmitSync = useCallback(async (label: string, tasks: Array<Promise<unknown>>) => {
        const results = await Promise.allSettled(tasks);
        const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (rejected) {
            console.error(`Failed to refresh after ${label}`, rejected.reason);
        }
    }, []);

    const shouldCloseOnSuccessfulSubmit = !semesterId || closeOnSuccess;

    const finalizeSuccessfulSubmit = useCallback(async (label: string, tasks: Array<Promise<unknown>>) => {
        if (shouldCloseOnSuccessfulSubmit) {
            onClose();
        }
        await runPostSubmitSync(label, tasks);
    }, [onClose, runPostSubmitSync, shouldCloseOnSuccessfulSubmit]);

    const handleAddExisting = async (courseId: string) => {
        try {
            await api.updateCourse(courseId, { semester_id: semesterId });
            await finalizeSuccessfulSubmit('adding existing course', [
                Promise.resolve(onCourseAdded()),
                fetchProgramCourses(),
                fetchUnassigned(),
            ]);
        } catch (error) {
            console.error("Failed to add course to semester", error);
            await showAlert({
                title: 'Add failed',
                description: 'Failed to add the course to this Semester.',
            });
        }
    };

    const trimmedNewName = newName.trim();
    const parsedCredits = Number(newCredits);
    const parsedGrade = Number(newGrade);
    const isNameInvalid = trimmedNewName.length === 0;
    const isCreditsInvalid = !Number.isFinite(parsedCredits) || parsedCredits <= 0;
    const isGradeInvalid = !Number.isFinite(parsedGrade) || parsedGrade < 0 || parsedGrade > 100;
    const isCreateFormInvalid = isNameInvalid || isCreditsInvalid || isGradeInvalid;
    const showNameInvalid = hasAttemptedCreateSubmit && isNameInvalid;
    const showCreditsInvalid = hasAttemptedCreateSubmit && isCreditsInvalid;
    const showGradeInvalid = hasAttemptedCreateSubmit && isGradeInvalid;

    const handleCreateNew = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setHasAttemptedCreateSubmit(true);
        if (isCreateFormInvalid) {
            return;
        }
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

            resetCreateDraft();
            await finalizeSuccessfulSubmit('creating course', [
                Promise.resolve(onCourseAdded()),
                fetchProgramCourses(),
                ...(semesterId ? [fetchUnassigned()] : []),
            ]);
        } catch (error) {
            console.error("Failed to create course", error);
            await showAlert({
                title: 'Create failed',
                description: 'Failed to create course.',
            });
        }
    }, [confirm, fetchProgramCourses, fetchUnassigned, finalizeSuccessfulSubmit, findDuplicateCourses, isCreateFormInvalid, newAlias, newCategory, newCredits, newGrade, newName, onCourseAdded, programId, resetCreateDraft, semesterId, showAlert]);

    const handleImportFromLms = useCallback(async () => {
        if (selectedLmsCourseIds.length === 0) return;
        setIsImporting(true);
        try {
            const response = await api.importProgramLmsCourses(programId, {
                external_course_ids: selectedLmsCourseIds,
                semester_id: semesterId,
            });
            setSelectedLmsCourseIds([]);
            await runPostSubmitSync('importing LMS courses', [
                Promise.resolve(onCourseAdded()),
                fetchProgramLmsCourses(),
                fetchProgramCourses(),
                ...(semesterId ? [fetchUnassigned()] : []),
            ]);

            const summary = buildImportSummary(response.results);
            const hasImportWarnings = summary.conflictCount > 0 || summary.skippedCount > 0;
            if (semesterId && closeOnSuccess && summary.createdCount > 0) {
                onClose();
            } else if (!semesterId && !hasImportWarnings) {
                onClose();
            }

            if (hasImportWarnings) {
                await showAlert({
                    title: summary.createdCount > 0 ? 'Import completed with conflicts' : 'Import blocked',
                    description: summary.description,
                });
            } else {
                if (!(semesterId && closeOnSuccess)) {
                    await showAlert({
                        title: 'Import completed',
                        description: summary.description,
                    });
                }
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
    }, [buildImportSummary, closeOnSuccess, fetchProgramCourses, fetchProgramLmsCourses, fetchUnassigned, onClose, onCourseAdded, programId, runPostSubmitSync, selectedLmsCourseIds, semesterId, showAlert]);

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
            setSelectedCalendarFile(null);
            await finalizeSuccessfulSubmit('importing calendar courses', [
                Promise.resolve(onCourseAdded()),
                fetchProgramCourses(),
                ...(semesterId ? [fetchUnassigned()] : []),
            ]);
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
    const createCourseFormId = `course-create-form-${semesterId ?? programId}`;
    const desktopContentClassName = "flex h-[85vh] max-h-[44rem] flex-col overflow-hidden sm:max-w-[640px]";
    const mobileContentClassName = "flex h-[85vh] max-h-[85vh] flex-col overflow-hidden";
    const surfaceBodyClassName = cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        isMobile && "px-4"
    );

    const footer = (
        <>
            <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading || isImporting || isCalendarImporting}
            >
                {mode === 'list' ? 'Close' : 'Cancel'}
            </Button>
            {mode === 'create' ? (
                <Button type="submit" form={createCourseFormId}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Course
                </Button>
            ) : null}
            {mode === 'calendar' ? (
                <Button
                    type="button"
                    disabled={!selectedCalendarFile || isCalendarImporting}
                    onClick={() => void handleImportFromCalendar()}
                >
                    <Upload className="mr-2 h-4 w-4" />
                    {isCalendarImporting ? 'Importing...' : 'Import Courses From Calendar'}
                </Button>
            ) : null}
            {mode === 'import' ? (
                <Button
                    type="button"
                    disabled={selectedLmsCourseIds.length === 0 || isImporting}
                    onClick={() => void handleImportFromLms()}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    {isImporting ? 'Importing...' : `Import ${selectedLmsCourseIds.length || ''} LMS Course${selectedLmsCourseIds.length === 1 ? '' : 's'}`}
                </Button>
            ) : null}
        </>
    );

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

                <TabsContent value="list" className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {semesterId ? (
                        <div className="flex h-full min-h-0 flex-col overflow-hidden">
                            <div className="relative flex-none">
                                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={existingCourseSearchQuery}
                                    onChange={(event) => setExistingCourseSearchQuery(event.target.value)}
                                    placeholder="Search existing courses..."
                                    className="pl-9"
                                />
                            </div>
                            <Separator className="my-4" />
                            <div className="min-h-0 min-w-0 flex-1">
                                {isLoading ? (
                                    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 py-9 text-center">
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
                                        surface="inherit"
                                        title="No courses found"
                                        description="All courses are already assigned to semesters."
                                    />
                                ) : filteredUnassignedCourses.length === 0 ? (
                                    <AppEmptyState
                                        scenario="no-results"
                                        size="modal"
                                        surface="inherit"
                                        title="No matching courses"
                                        description="Try a different keyword."
                                    />
                                ) : (
                                    <ScrollArea className="h-full min-h-0 min-w-0">
                                        <div className="w-full min-w-0 max-w-full pr-3">
                                            {filteredUnassignedCourses.map(course => (
                                                <div key={course.id} className={cn(
                                                    "flex items-start justify-between gap-3 border-b border-border/70 py-4 transition-colors last:border-b-0",
                                                    "hover:text-foreground"
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

                <TabsContent value="create" className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <form
                        id={createCourseFormId}
                        noValidate
                        onSubmit={handleCreateNew}
                        className="flex h-full min-h-0 flex-col overflow-hidden"
                    >
                        <ScrollArea className="h-full min-h-0 flex-1">
                            <div className="grid content-start gap-4 pr-3">
                            <Field data-invalid={showNameInvalid ? true : undefined}>
                                <FieldLabel htmlFor="course-name">
                                    Course Name <span className="text-destructive">*</span>
                                </FieldLabel>
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
                                    aria-invalid={showNameInvalid ? true : undefined}
                                    placeholder="e.g. Introduction to Computer Science"
                                />
                                {showNameInvalid ? (
                                    <FieldError>Enter a course name before creating the course.</FieldError>
                                ) : (
                                    <FieldDescription>
                                        Name this course as it should appear across the Program.
                                    </FieldDescription>
                                )}
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="course-category">Category</FieldLabel>
                                <Input
                                    id="course-category"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    placeholder="e.g. CS"
                                />
                                <FieldDescription>Usually the subject code. It can be auto-detected from the course name.</FieldDescription>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="course-alias">Alias</FieldLabel>
                                <Input
                                    id="course-alias"
                                    value={newAlias}
                                    onChange={e => setNewAlias(e.target.value)}
                                    placeholder="e.g. CS101 - Prof. Smith"
                                />
                                <FieldDescription>Optional short label for compact views.</FieldDescription>
                            </Field>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field data-invalid={showCreditsInvalid ? true : undefined}>
                                    <FieldLabel htmlFor="course-credits">
                                        Credits <span className="text-destructive">*</span>
                                    </FieldLabel>
                                    <Input
                                        id="course-credits"
                                        type="number"
                                        step="0.5"
                                        value={newCredits}
                                        onChange={e => setNewCredits(e.target.value)}
                                        required
                                        aria-invalid={showCreditsInvalid ? true : undefined}
                                    />
                                    {showCreditsInvalid ? (
                                        <FieldError>Enter a valid credit value greater than 0.</FieldError>
                                    ) : null}
                                </Field>
                                <Field data-invalid={showGradeInvalid ? true : undefined}>
                                    <FieldLabel htmlFor="course-grade">
                                        Grade (%) <span className="text-destructive">*</span>
                                    </FieldLabel>
                                    <Input
                                        id="course-grade"
                                        type="number"
                                        step="0.1"
                                        value={newGrade}
                                        onChange={e => setNewGrade(e.target.value)}
                                        required
                                        aria-invalid={showGradeInvalid ? true : undefined}
                                    />
                                    {showGradeInvalid ? (
                                        <FieldError>Enter a valid grade between 0 and 100.</FieldError>
                                    ) : null}
                                </Field>
                            </div>
                            </div>
                        </ScrollArea>
                    </form>
                </TabsContent>

                <TabsContent value="calendar" className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <ScrollArea className="h-full min-h-0 flex-1">
                        <div className="grid gap-3 pr-3">
                            <FieldLabel>ICS File</FieldLabel>
                            <div
                                className={cn(
                                    "flex min-h-[15rem] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all sm:min-h-[18rem]",
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
                                        <>
                                            <Upload className="h-8 w-8 text-primary" />
                                            <div className="text-base font-semibold text-foreground">
                                                {selectedCalendarFile.name}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                Ready to import into this Program{semesterId ? ' and Semester' : ''}.
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-muted-foreground/50" />
                                            <div className="space-y-1">
                                                <div className="text-base font-medium text-foreground">Drop an ICS file here</div>
                                                <div className="text-sm text-muted-foreground">or click to browse</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="import" className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                        <LmsCourseSelectionList
                            courses={availableLmsCourses}
                            selectedCourseIds={selectedLmsCourseIds}
                            onSelectionChange={setSelectedLmsCourseIds}
                            disabledCourseReasons={linkedLmsCourseReasons}
                        />
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
            descriptionClassName="sr-only"
            desktopContentClassName={desktopContentClassName}
            mobileContentClassName={mobileContentClassName}
            footer={footer}
            desktopFooterClassName="border-t bg-background pt-4"
            mobileFooterClassName="border-t bg-background pt-2"
        >
            {modalBody}
        </ResponsiveDialogDrawer>
    );
};
