// input:  [program context state, semester/course CRUD APIs, Program subject-color settings, Program LMS integrations/courses, dedicated Program settings routing, course-manager modal flows, responsive overlay wrapper, shared business empty-state wrappers, and shadcn AlertDialog interactions]
// output: [`ProgramDashboard` and local semester/course delete confirmation plus responsive create surface components]
// pos:    [Program-level workspace page for semester management, right-aligned shadcn-style Program settings navigation, LMS-backed import flows, a three-tab semester create/import surface, subject-code color defaults, progress tracking, synchronized assigned/unassigned course refresh, edit-mode course deletion, tri-state course-list sorting, and standardized not-found workspace fallbacks]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useEffect, useId, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AppEmptyState } from '../components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Container } from '../components/Container';
import api, { type Course } from '../services/api';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardSkeleton, SemesterCardSkeleton, TextSkeleton } from '../components/skeletons';
import { ProgramDataProvider, useProgramData } from '../contexts/ProgramDataContext';
import { CourseManagerModal } from '../components/CourseManagerModal';
import { useDialog } from '../contexts/DialogContext';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Settings, Plus, Upload, Search, Trash2, GraduationCap, Percent, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, X, Tag, Calendar, Hash, TrendingUp, Layers, Pencil, CheckCheck } from 'lucide-react';
import { ResponsiveDialogDrawer } from '../components/ResponsiveDialogDrawer';
import { LmsCourseSelectionList } from '../components/LmsCourseSelectionList';
import { getCourseBadgeStyle, getCourseCategoryBadgeClassName, parseSubjectColorMap, resolveCourseColor, resolveCourseSubjectCode, resolveSubjectColorAssignments } from '@/utils/courseCategoryBadge';

// Helper function to extract course level from course name
const extractCourseLevel = (courseName: string): number | null => {
    // Match patterns like "CS 101", "MAT180", "MAT 180", "MAT-180", "MATH180", etc.
    // Look for 3-4 digit course numbers where the first digit is 1-5
    const match = courseName.match(/([1-5])(\d{2,3})(?!\d)/);
    if (match) {
        const level = parseInt(match[1], 10);
        return level * 100; // Return 100, 200, 300, 400, or 500
    }
    return null;
};

type ShowAlert = ReturnType<typeof useDialog>['alert'];
type CourseSortConfig = { key: string; direction: 'asc' | 'desc' };
type CourseWithProgramContext = Course & { semesterName: string; semesterId: string };

type CreateSemesterDialogButtonProps = {
    programId: string;
    onCreated: () => Promise<void>;
    showAlert: ShowAlert;
    className?: string;
    size?: React.ComponentProps<typeof Button>['size'];
    variant?: React.ComponentProps<typeof Button>['variant'];
    children: React.ReactNode;
};

const CreateSemesterDialogButton: React.FC<CreateSemesterDialogButtonProps> = ({
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
                        title: "Select a calendar file",
                        description: "Upload an .ics file before creating a semester from calendar.",
                    });
                    return;
                }
                await api.uploadSemesterICS(programId, selectedFile, newSemesterName || undefined);
            } else if (mode === 'lms') {
                if (selectedLmsCourseIds.length === 0) {
                    await showAlert({
                        title: "Select LMS courses",
                        description: "Choose at least one LMS course before importing a semester from LMS.",
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
                    name: newSemesterName
                });
            }
            setOpen(false);
            setMode('create');
            setNewSemesterName('');
            setSelectedFile(null);
            setSelectedLmsCourseIds([]);
            await onCreated();
        } catch (error) {
            console.error("Failed to create semester", error);
            await showAlert({
                title: "Create failed",
                description: "Failed to create semester."
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
            title: "Invalid file",
            description: "Please upload a valid .ics file."
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
                desktopHeaderClassName="border-b px-6 py-4 flex-none"
                mobileHeaderClassName="border-b px-6 py-4 flex-none"
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
                desktopFooterClassName="border-t px-6 py-4 flex-none"
                mobileFooterClassName="border-t px-6 py-4 flex-none"
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

type DeleteSemesterButtonProps = {
    semesterId: string;
    semesterName: string;
    onDeleted: () => Promise<void>;
    showAlert: ShowAlert;
};

const DeleteSemesterButton: React.FC<DeleteSemesterButtonProps> = ({
    semesterId,
    semesterName,
    onDeleted,
    showAlert,
}) => {
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const submitDeleteSemester = useCallback(async () => {
        setIsDeleting(true);
        try {
            await api.deleteSemester(semesterId);
            setOpen(false);
            await onDeleted();
        } catch (error) {
            console.error("Failed to delete semester", error);
            await showAlert({
                title: "Delete failed",
                description: "Failed to delete semester."
            });
        } finally {
            setIsDeleting(false);
        }
    }, [onDeleted, semesterId, showAlert]);

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDeleting) {
                        setOpen(true);
                    }
                }}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
            <AlertDialog open={open} onOpenChange={(nextOpen) => !isDeleting && setOpen(nextOpen)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete semester?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {`Are you sure you want to delete ${semesterName || 'this semester'}? This action cannot be undone.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={submitDeleteSemester} disabled={isDeleting}>
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

const ProgramDashboardContent: React.FC = () => {
    const { program, saveProgram, refreshProgram, isLoading } = useProgramData();
    const { alert: showAlert } = useDialog();
    const [unassignedCourses, setUnassignedCourses] = useState<Array<CourseWithProgramContext>>([]);
    const [isCourseEditMode, setIsCourseEditMode] = useState(false);
    const [coursePendingDelete, setCoursePendingDelete] = useState<CourseWithProgramContext | null>(null);
    const [isDeletingCourse, setIsDeletingCourse] = useState(false);

    // Modal State
    const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [courseSearchQuery, setCourseSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<CourseSortConfig | null>(null);
    const [activeFilters, setActiveFilters] = useState<Array<{ type: string; value: string; label: string }>>([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const courseEditModeLabel = isCourseEditMode ? 'Exit course edit mode' : 'Enter course edit mode';

    const refreshUnassignedCourses = useCallback(async () => {
        if (!program?.id) {
            setUnassignedCourses([]);
            return;
        }

        const courses = await api.getCoursesForProgram(program.id, { unassigned: true });
        setUnassignedCourses(
            courses.map((course) => ({
                ...course,
                semesterName: 'Unassigned',
                semesterId: '',
            })),
        );
    }, [program?.id]);

    const refreshDashboardData = useCallback(async () => {
        await Promise.all([
            refreshProgram(),
            refreshUnassignedCourses(),
        ]);
    }, [refreshProgram, refreshUnassignedCourses]);

    const handleUpdateProgram = useCallback(async (data: any) => {
        if (!program) return;
        await saveProgram(data);
    }, [program, saveProgram]);

    const subjectColorMap = useMemo(
        () => parseSubjectColorMap(program?.subject_color_map),
        [program?.subject_color_map],
    );
    const programCourses = useMemo<Array<CourseWithProgramContext>>(() => {
        if (!program) return [];
        const semesterCourses = program.semesters.flatMap((semester) =>
            (semester.courses || []).map((course) => ({
                ...course,
                semesterName: semester.name,
                semesterId: semester.id,
            })),
        );
        return [...semesterCourses, ...unassignedCourses];
    }, [program, unassignedCourses]);
    const totalCredits = React.useMemo(() => {
        return programCourses.reduce((acc, course) => acc + (course.credits || 0), 0);
    }, [programCourses]);

    const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

    const filteredSemesters = useMemo(() => {
        if (!program) return [];
        if (!normalizedQuery) return program.semesters;
        return program.semesters.filter(semester =>
            semester.name.toLowerCase().includes(normalizedQuery)
        );
    }, [program, normalizedQuery]);

    useEffect(() => {
        let active = true;

        const loadUnassignedCourses = async () => {
            try {
                if (!program?.id) {
                    if (active) {
                        setUnassignedCourses([]);
                    }
                    return;
                }
                const courses = await api.getCoursesForProgram(program.id, { unassigned: true });
                if (!active) {
                    return;
                }
                setUnassignedCourses(
                    courses.map((course) => ({
                        ...course,
                        semesterName: 'Unassigned',
                        semesterId: '',
                    })),
                );
            } catch (error) {
                if (!active) {
                    return;
                }
                console.error('Failed to fetch unassigned program courses', error);
                setUnassignedCourses([]);
            }
        };

        void loadUnassignedCourses();

        return () => {
            active = false;
        };
    }, [program?.id]);

    // Extract unique values for suggestions
    const suggestions = useMemo(() => {
        if (!program) return [];

        const allCourses = programCourses;

        const categories = Array.from(new Set(allCourses.map(c => c.category).filter(Boolean)));
        const semesters = Array.from(new Set(allCourses.map(c => c.semesterName)));
        const credits = Array.from(new Set(allCourses.map(c => c.credits)));
        const levels = Array.from(new Set(
            allCourses.map(c => extractCourseLevel(c.name)).filter((level): level is number => level !== null)
        )).sort((a, b) => a - b);

        const items: Array<{ type: string; value: string; label: string; icon: any }> = [];

        // Add category suggestions
        categories.forEach(cat => {
            items.push({
                type: 'category',
                value: cat!,
                label: `Category: ${cat}`,
                icon: Tag
            });
        });

        // Add semester suggestions
        semesters.forEach(sem => {
            items.push({
                type: 'semester',
                value: sem,
                label: `Semester: ${sem}`,
                icon: Calendar
            });
        });

        // Add credit suggestions
        credits.sort((a, b) => a - b).forEach(cred => {
            items.push({
                type: 'credits',
                value: String(cred),
                label: `Credits: ${cred}`,
                icon: Hash
            });
        });

        // Add level suggestions
        levels.forEach(level => {
            items.push({
                type: 'level',
                value: String(level),
                label: `Level: ${level}`,
                icon: Layers
            });
        });

        // Add GPA threshold suggestions
        items.push(
            { type: 'gpa', value: '3.0', label: 'GPA ≥ 3.0', icon: TrendingUp },
            { type: 'gpa', value: '3.5', label: 'GPA ≥ 3.5', icon: TrendingUp },
            { type: 'gpa', value: '4.0', label: 'GPA = 4.0', icon: TrendingUp }
        );

        return items;
    }, [program, programCourses]);

    // Filter suggestions based on search query
    const filteredSuggestions = useMemo(() => {
        if (!courseSearchQuery.trim()) return suggestions;
        const query = courseSearchQuery.toLowerCase();
        return suggestions.filter(s => s.label.toLowerCase().includes(query));
    }, [suggestions, courseSearchQuery]);

    const filteredAndSortedCourses = useMemo(() => {
        if (!program) return [];

        let courses = [...programCourses];

        // Apply active filters
        if (activeFilters.length > 0) {
            courses = courses.filter(course => {
                return activeFilters.every(filter => {
                    switch (filter.type) {
                        case 'category':
                            return course.category === filter.value;
                        case 'semester':
                            return course.semesterName === filter.value;
                        case 'credits':
                            return String(course.credits) === filter.value;
                        case 'level': {
                            const courseLevel = extractCourseLevel(course.name);
                            return courseLevel !== null && String(courseLevel) === filter.value;
                        }
                        case 'gpa': {
                            const threshold = parseFloat(filter.value);
                            if (threshold === 4.0) {
                                return course.grade_scaled === 4.0;
                            }
                            return course.grade_scaled >= threshold;
                        }
                        default:
                            return true;
                    }
                });
            });
        }

        // Apply text search
        if (courseSearchQuery.trim() && activeFilters.length === 0) {
            const query = courseSearchQuery.toLowerCase();
            courses = courses.filter(course =>
                course.name.toLowerCase().includes(query) ||
                (course.alias && course.alias.toLowerCase().includes(query)) ||
                (course.category && course.category.toLowerCase().includes(query))
            );
        }

        if (sortConfig) {
            courses.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof typeof a];
                let bValue: any = b[sortConfig.key as keyof typeof b];

                // Handle special sorting cases
                if (sortConfig.key === 'semesterName') {
                    // For simplicity, sorting by semester name string for now.
                    // Ideally could sort by semester logical order if available.
                } else if (sortConfig.key === 'category') {
                    aValue = a.category || '';
                    bValue = b.category || '';
                } else if (sortConfig.key === 'grade_percentage') {
                    // Use scaling if percentage is not the primary sort or same?
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return courses;
    }, [program, programCourses, courseSearchQuery, sortConfig, activeFilters]);

    const discoveredSubjectCodes = useMemo(() => {
        if (!program) return [];
        return Array.from(new Set(
            programCourses
                .map((course) => resolveCourseSubjectCode(course))
                .filter(Boolean),
        )).sort((left, right) => left.localeCompare(right));
    }, [programCourses]);
    const resolvedSubjectColorMap = useMemo(
        () => resolveSubjectColorAssignments(discoveredSubjectCodes, subjectColorMap),
        [discoveredSubjectCodes, subjectColorMap],
    );

    const requestSort = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) {
            setSortConfig({ key, direction: 'asc' });
            return;
        }
        if (sortConfig.direction === 'asc') {
            setSortConfig({ key, direction: 'desc' });
            return;
        }
        setSortConfig(null);
    };

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="ml-2 h-4 w-4 text-foreground" />
            : <ArrowDown className="ml-2 h-4 w-4 text-foreground" />;
    };

    const handleAddFilter = (suggestion: { type: string; value: string; label: string }) => {
        // Check if filter already exists
        const exists = activeFilters.some(f => f.type === suggestion.type && f.value === suggestion.value);
        if (!exists) {
            setActiveFilters([...activeFilters, suggestion]);
        }
        setCourseSearchQuery('');
        setIsSuggestionsOpen(false);
        setSelectedSuggestionIndex(-1);
    };

    const handleRemoveFilter = (index: number) => {
        setActiveFilters(activeFilters.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isSuggestionsOpen || filteredSuggestions.length === 0) {
            if (e.key === 'ArrowDown' && !isSuggestionsOpen) {
                setIsSuggestionsOpen(true);
                setSelectedSuggestionIndex(0);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev < filteredSuggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
                    handleAddFilter(filteredSuggestions[selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsSuggestionsOpen(false);
                setSelectedSuggestionIndex(-1);
                break;
        }
    };

    const submitDeleteCourse = useCallback(async () => {
        if (!coursePendingDelete) {
            return;
        }

        setIsDeletingCourse(true);
        try {
            await api.deleteCourse(coursePendingDelete.id);
            setCoursePendingDelete(null);
            await refreshDashboardData();
        } catch (error) {
            console.error('Failed to delete course', error);
            await showAlert({
                title: 'Delete failed',
                description: 'Failed to delete course.',
            });
        } finally {
            setIsDeletingCourse(false);
        }
    }, [coursePendingDelete, refreshDashboardData, showAlert]);

    const creditsProgressPercent = useMemo(() => {
        if (!program) return 0;
        const maxCredits = program.grad_requirement_credits || 0;
        if (maxCredits <= 0) return 0;
        return Math.min((totalCredits / maxCredits) * 100, 100);
    }, [program, totalCredits]);

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                        <Link to="/">Academics</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-semibold">
                        {program?.name || 'Program'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    if (!isLoading && !program) {
        return (
            <Layout>
                <Container>
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Program not found"
                        description="The program you are looking for does not exist or has been deleted."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
                </Container>
            </Layout>
        );
    }

    return (
        <Layout breadcrumb={breadcrumb}>
            <div className="sticky-page-header border-b bg-background sticky top-[60px] z-20">
                <Container className="py-4 md:py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            {isLoading || !program ? (
                                <Skeleton className="h-8 w-48" />
                            ) : (
                                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                                        {program.name}
                                    </h1>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {program && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link to={`/programs/${program.id}/settings`}>
                                        <Settings />
                                    </Link>
                                </Button>
                            )}
                            <Button
                                onClick={(e) => {
                                    e.currentTarget.blur();
                                    setIsCourseModalOpen(true);
                                }}
                                variant="outline"
                                size="sm"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Course
                            </Button>
                            {program && (
                                <CreateSemesterDialogButton
                                    programId={program.id}
                                    onCreated={refreshDashboardData}
                                    showAlert={showAlert}
                                    size="sm"
                                >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Semester
                                </CreateSemesterDialogButton>
                            )}
                        </div>
                    </div>
                </Container>
            </div>

            <Container className="py-8 md:py-10 space-y-8 md:space-y-10">
                {isLoading || !program ? (
                    <>
                        {/* Overview Section Skeleton */}
                        <section>
                            <TextSkeleton variant="h3" className="mb-4" />
                            <div className="grid gap-4 md:grid-cols-3">
                                {[1, 2, 3].map(i => (
                                    <StatCardSkeleton key={i} />
                                ))}
                            </div>
                        </section>

                        <Separator />

                        {/* Semesters Section Skeleton */}
                        <section className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <TextSkeleton variant="h3" />
                                <Skeleton className="h-10 w-full max-w-sm" />
                            </div>
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <SemesterCardSkeleton key={i} />
                                ))}
                            </div>
                        </section>
                    </>
                ) : (
                    <>
                        {/* Stats Section */}
                        <section>
                            <h2 className="text-lg font-semibold tracking-tight mb-4 flex items-center gap-2">
                                Overview
                            </h2>
                                <div className="md:hidden relative rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
                                    <Button
                                        onClick={() => handleUpdateProgram({ hide_gpa: !program.hide_gpa })}
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-3 top-3 h-5 w-5 p-0"
                                        aria-label={program.hide_gpa ? 'Show GPA' : 'Hide GPA'}
                                    >
                                        {program.hide_gpa ? (
                                            <EyeOff className="h-3 w-3" />
                                        ) : (
                                            <Eye className="h-3 w-3" />
                                        )}
                                    </Button>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="min-w-0">
                                            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                                                <GraduationCap className="h-3 w-3" />
                                                <span>GPA</span>
                                            </div>
                                            <div className="text-lg font-semibold leading-none">
                                                {program.hide_gpa ? '****' : (
                                                    <AnimatedNumber
                                                        value={program.cgpa_scaled}
                                                        format={(val) => val.toFixed(2)}
                                                        animateOnMount
                                                        rainbowThreshold={3.8}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                                                <Percent className="h-3 w-3" />
                                                <span>Avg</span>
                                            </div>
                                            <div className="text-lg font-semibold leading-none">
                                                {program.hide_gpa ? '****' : (
                                                    <>
                                                        <AnimatedNumber
                                                            value={program.cgpa_percentage}
                                                            format={(val) => val.toFixed(1)}
                                                            animateOnMount
                                                        />
                                                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">%</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                                                <BookOpen className="h-3 w-3" />
                                                <span>Credits</span>
                                            </div>
                                            <div className="text-lg font-semibold leading-none">
                                                <AnimatedNumber
                                                    value={totalCredits}
                                                    format={(val) => val.toFixed(1)} // Format cleaner
                                                    animateOnMount
                                                />
                                                <span className="mx-0.5 text-xs font-normal text-muted-foreground">/</span>
                                                <span className="text-xs font-normal text-muted-foreground">{program.grad_requirement_credits}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="hidden gap-4 md:grid md:grid-cols-3">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">CGPA (Scaled)</CardTitle>
                                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold flex items-center justify-between">
                                                {program.hide_gpa ? '****' : (
                                                    <AnimatedNumber
                                                        value={program.cgpa_scaled}
                                                        format={(val) => val.toFixed(2)}
                                                        animateOnMount
                                                        rainbowThreshold={3.8}
                                                    />
                                                )}
                                                <Button
                                                    onClick={() => handleUpdateProgram({ hide_gpa: !program.hide_gpa })}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                >
                                                    {program.hide_gpa ? (
                                                        <EyeOff className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Eye className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Cumulative Grade Point Average
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Average</CardTitle>
                                            <Percent className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">
                                                {program.hide_gpa ? '****' : (
                                                    <>
                                                        <AnimatedNumber
                                                            value={program.cgpa_percentage}
                                                            format={(val) => val.toFixed(1)}
                                                            animateOnMount
                                                        />
                                                        <span className="text-base font-normal text-muted-foreground ml-1">%</span>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Overall score percentage
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Credits Progress</CardTitle>
                                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">
                                                <AnimatedNumber
                                                    value={totalCredits}
                                                    format={(val) => val.toFixed(1)} // Format cleaner
                                                    animateOnMount
                                                />
                                                <span className="text-base font-normal text-muted-foreground mx-1">/</span>
                                                <span className="text-base font-normal text-muted-foreground">{program.grad_requirement_credits}</span>
                                            </div>
                                            <Progress value={creditsProgressPercent} className="mt-2 h-2" />
                                        </CardContent>
                                    </Card>
                                </div>
                            </section>

                            <Separator />

                            {/* Semesters Section */}
                            <section className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                    <h2 className="text-lg font-semibold tracking-tight">
                                        Semesters
                                    </h2>
                                    <div className="relative flex-1 max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search semesters..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 h-10"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {filteredSemesters.map(semester => (
                                    <div key={semester.id} className="group relative">
                                        <Link to={`/semesters/${semester.id}`} className="block h-full">
                                            <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-lg font-semibold truncate pr-8">
                                                        {semester.name}
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">GPA</p>
                                                            <p className="text-lg font-semibold">
                                                                <AnimatedNumber
                                                                    value={semester.average_scaled}
                                                                    format={(val) => val.toFixed(2)}
                                                                />
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Average</p>
                                                            <p className="text-lg font-semibold">{semester.average_percentage.toFixed(1)}%</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm text-muted-foreground">
                                                        <span>{(semester as any).courses?.length || 0} Courses</span>
                                                        <div
                                                            className={`h-2 w-2 rounded-full ${semester.average_scaled >= 3.0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                        />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                        <div className="absolute right-4 top-4 z-20">
                                            <DeleteSemesterButton
                                                semesterId={semester.id}
                                                semesterName={semester.name}
                                                onDeleted={refreshDashboardData}
                                                showAlert={showAlert}
                                            />
                                        </div>
                                    </div>
                                ))}
                                    {filteredSemesters.length === 0 && (
                                        <div className="col-span-full border rounded-lg border-dashed p-8 text-center">
                                            <p className="text-muted-foreground">No semesters found</p>
                                            {program && (
                                                <CreateSemesterDialogButton
                                                    programId={program.id}
                                                    onCreated={refreshDashboardData}
                                                    showAlert={showAlert}
                                                    variant="link"
                                                    className="mt-2 text-primary"
                                                >
                                                    Create one
                                                </CreateSemesterDialogButton>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* All Courses Section */}
                            <section className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 md:mt-auto">
                                        <h2 className="text-lg font-semibold tracking-tight">
                                            All Courses
                                        </h2>
                                        <Button
                                            type="button"
                                            variant={isCourseEditMode ? 'secondary' : 'ghost'}
                                            size="icon"
                                            className={isCourseEditMode ? 'text-foreground' : 'text-muted-foreground'}
                                            aria-label={courseEditModeLabel}
                                            title={courseEditModeLabel}
                                            aria-pressed={isCourseEditMode}
                                            onClick={() => {
                                                setIsCourseEditMode((current) => {
                                                    if (current) {
                                                        setCoursePendingDelete(null);
                                                    }
                                                    return !current;
                                                });
                                            }}
                                        >
                                            {isCourseEditMode ? (
                                                <CheckCheck className="h-4 w-4" />
                                            ) : (
                                                <Pencil className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                    <div className="flex-1 max-w-sm space-y-1.5">
                                        {/* Active Filters */}
                                        <div className="min-h-6">
                                            {activeFilters.length > 0 && (
                                                <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                                    {activeFilters.map((filter, index) => (
                                                        <Badge
                                                            key={`${filter.type}-${filter.value}`}
                                                            variant="secondary"
                                                            className="shrink-0 pl-2.5 pr-1.5 py-1 text-xs font-medium flex items-center gap-1.5"
                                                        >
                                                            {filter.label}
                                                            <button
                                                                onClick={() => handleRemoveFilter(index)}
                                                                className="hover:bg-muted/80 rounded-sm p-0.5 transition-colors"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {/* Search with Suggestions */}
                                        <Popover open={isSuggestionsOpen}>
                                            <PopoverTrigger asChild>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                                    <Input
                                                        ref={searchInputRef}
                                                        placeholder="Search or filter courses..."
                                                        value={courseSearchQuery}
                                                        onChange={(e) => {
                                                            setCourseSearchQuery(e.target.value);
                                                            setIsSuggestionsOpen(true);
                                                            setSelectedSuggestionIndex(-1);
                                                        }}
                                                        onFocus={() => setIsSuggestionsOpen(true)}
                                                        onBlur={(e) => {
                                                            // Don't close if clicking inside the popover content
                                                            const relatedTarget = e.relatedTarget as HTMLElement | null;
                                                            if (relatedTarget?.closest('[data-radix-popper-content-wrapper]')) {
                                                                return;
                                                            }
                                                            setIsSuggestionsOpen(false);
                                                            setSelectedSuggestionIndex(-1);
                                                        }}
                                                        onKeyDown={handleKeyDown}
                                                        className="pl-9 h-10"
                                                    />
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                className="w-[var(--radix-popover-trigger-width)] p-0 rounded-lg"
                                                align="start"
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                                onInteractOutside={(e) => {
                                                    // Don't close if clicking on the input trigger
                                                    const target = e.target as HTMLElement | null;
                                                    if (target === searchInputRef.current || target?.closest('[data-radix-popover-trigger]')) {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                    setIsSuggestionsOpen(false);
                                                    setSelectedSuggestionIndex(-1);
                                                }}
                                            >
                                                <Command className="rounded-lg">
                                                    <CommandList>
                                                        {filteredSuggestions.length === 0 ? (
                                                            <CommandEmpty>No suggestions found.</CommandEmpty>
                                                        ) : (
                                                            <CommandGroup heading="Filter by">
                                                                {filteredSuggestions.map((suggestion, index) => {
                                                                    const Icon = suggestion.icon;
                                                                    return (
                                                                        <CommandItem
                                                                            key={`${suggestion.type}-${suggestion.value}`}
                                                                            onSelect={() => handleAddFilter(suggestion)}
                                                                            className={`cursor-pointer hover:bg-accent/60 data-selected:bg-transparent ${
                                                                                index === selectedSuggestionIndex ? 'bg-accent' : ''
                                                                            }`}
                                                                        >
                                                                            <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                                                            <span>{suggestion.label}</span>
                                                                        </CommandItem>
                                                                    );
                                                                })}
                                                            </CommandGroup>
                                                        )}
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="rounded-md border bg-card min-h-[300px] flex flex-col overflow-hidden">
                                    {filteredAndSortedCourses.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                            {courseSearchQuery || activeFilters.length > 0 ? "No courses found matching your search." : "No courses added yet."}
                                        </div>
                                    ) : (
                                    <Table>
                                                <TableHeader className="sticky top-0 bg-card">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => requestSort('name')}
                                                >
                                                    <div className="flex items-center">
                                                        Course Name
                                                        {getSortIcon('name')}
                                                    </div>
                                                </TableHead>
                                                <TableHead
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => requestSort('category')}
                                                >
                                                    <div className="flex items-center">
                                                        Category
                                                        {getSortIcon('category')}
                                                    </div>
                                                </TableHead>
                                                <TableHead
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => requestSort('semesterName')}
                                                >
                                                    <div className="flex items-center">
                                                        Semester
                                                        {getSortIcon('semesterName')}
                                                    </div>
                                                </TableHead>
                                                <TableHead
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => requestSort('credits')}
                                                >
                                                    <div className="flex items-center">
                                                        Credits
                                                        {getSortIcon('credits')}
                                                    </div>
                                                </TableHead>
                                                <TableHead
                                                    className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => requestSort('grade_percentage')}
                                                >
                                                    <div className="flex items-center justify-end">
                                                        Grade
                                                        {getSortIcon('grade_percentage')}
                                                    </div>
                                                </TableHead>
                                                <TableHead
                                                    className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => requestSort('grade_scaled')}
                                                >
                                                    <div className="flex items-center justify-end">
                                                        GPA
                                                        {getSortIcon('grade_scaled')}
                                                    </div>
                                                </TableHead>
                                                <TableHead
                                                    className="w-[52px] text-right"
                                                    aria-label="Row actions"
                                                />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                                    {filteredAndSortedCourses.map(course => (
                                                    <TableRow key={course.id} className="h-12">
                                                        <TableCell className="font-medium">
                                                            <div className="flex flex-col">
                                                                <Link to={`/courses/${course.id}`} className="hover:underline">
                                                                    {course.name}
                                                                </Link>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                                    {course.category && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`border-0 font-medium ${getCourseCategoryBadgeClassName(course.category)}`}
                                                                    style={getCourseBadgeStyle(resolveCourseColor(course, resolvedSubjectColorMap))}
                                                                >
                                                                    {course.category}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {course.semesterId ? (
                                                                <Link to={`/semesters/${course.semesterId}`} className="hover:underline">
                                                                    {course.semesterName}
                                                                </Link>
                                                            ) : (
                                                                <span>{course.semesterName}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{course.credits}</TableCell>
                                                        <TableCell className="text-right">
                                                            {course.hide_gpa ? '****' : (
                                                                <span>{course.grade_percentage.toFixed(1)}%</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {course.hide_gpa ? '****' : (
                                                                <span className={course.grade_scaled >= 3.0 ? 'text-emerald-600' : 'text-amber-600'}>
                                                                    <AnimatedNumber
                                                                        value={course.grade_scaled}
                                                                        format={(val) => val.toFixed(2)}
                                                                    />
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="w-[52px] text-right align-middle">
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                className={isCourseEditMode ? 'h-8 w-8' : 'h-8 w-8 opacity-0 pointer-events-none'}
                                                                aria-label={`Delete ${course.name}`}
                                                                aria-hidden={!isCourseEditMode}
                                                                tabIndex={isCourseEditMode ? 0 : -1}
                                                                onClick={() => setCoursePendingDelete(course)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    ))}
                                        </TableBody>
                                    </Table>
                                    )}
                                </div>
                            </section>
                    </>
                )}
            </Container>

            {program && (
                <CourseManagerModal
                    isOpen={isCourseModalOpen}
                    onClose={() => setIsCourseModalOpen(false)}
                    programId={program.id}
                    onCourseAdded={refreshDashboardData}
                />
            )}
            <AlertDialog
                open={coursePendingDelete !== null}
                onOpenChange={(nextOpen) => {
                    if (!isDeletingCourse && !nextOpen) {
                        setCoursePendingDelete(null);
                    }
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete course?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {`Are you sure you want to delete ${coursePendingDelete?.name || 'this course'}? This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingCourse}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={submitDeleteCourse}
                            disabled={isDeletingCourse}
                        >
                            {isDeletingCourse ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Layout>
    );
};

export const ProgramDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container>
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Program not found"
                        description="No program ID provided."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
                </Container>
            </Layout>
        );
    }

    return (
        <ProgramDataProvider programId={id}>
            <ProgramDashboardContent />
        </ProgramDataProvider>
    );
};
