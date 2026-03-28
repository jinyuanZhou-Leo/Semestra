// input:  [program context state, semester/course CRUD APIs, Program subject-color settings, Program LMS integrations/courses, dedicated Program settings routing, standalone Semester wizard routing, course-manager modal flows, responsive overlay wrapper, shared GPA-percentage formatting, shared business empty-state wrappers, and shadcn AlertDialog interactions]
// output: [`ProgramDashboard` route component for the Program workspace]
// pos:    [Program-level workspace page for semester management, right-aligned shadcn-style Program settings navigation, lightweight entry into the standalone Create Semester wizard with draft resume handling, hidden draft Semesters in dashboard lists, subject-code color defaults, progress tracking, synchronized assigned/unassigned course refresh, edit-mode course deletion, semester-card delete actions that stay below the sticky page header, tri-state course-list sorting, and shared empty-state treatment across Program sections]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AppEmptyState } from '../components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { formatGpaPercentage, formatGpaPercentageValue } from '@/utils/percentage';
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
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from '@/components/ui/combobox';
import { Settings, Plus, Search, Trash2, GraduationCap, Percent, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, Tag, Calendar, Hash, TrendingUp, Layers, Pencil, CheckCheck } from 'lucide-react';
import { getCourseBadgeStyle, getCourseCategoryBadgeClassName, parseSubjectColorMap, resolveCourseColor, resolveCourseSubjectCode, resolveSubjectColorAssignments } from '@/utils/courseCategoryBadge';
import { CreateSemesterWizardButton } from './program-dashboard/CreateSemesterWizardButton';
import { DeleteSemesterButton } from './program-dashboard/DeleteSemesterButton';

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

type CourseSortConfig = { key: string; direction: 'asc' | 'desc' };
type CourseWithProgramContext = Course & { semesterName: string; semesterId: string };
type CourseFilterSuggestion = {
    type: string;
    value: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
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
    const [activeFilters, setActiveFilters] = useState<CourseFilterSuggestion[]>([]);
    const suggestionsAnchor = useComboboxAnchor();
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
        const semesterCourses = program.semesters
            .filter((semester) => semester.lifecycle_state !== 'draft')
            .flatMap((semester) =>
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
        const visibleSemesters = program.semesters.filter((semester) => semester.lifecycle_state !== 'draft');
        if (!normalizedQuery) return visibleSemesters;
        return visibleSemesters.filter(semester =>
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

        const items: Array<CourseFilterSuggestion> = [];

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

        if (courseSearchQuery.trim()) {
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
        if (programCourses.length === 0) return [];
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
                            {program ? (
                                <CreateSemesterWizardButton
                                    programId={program.id}
                                    onChanged={refreshDashboardData}
                                    size="sm"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Semester
                                </CreateSemesterWizardButton>
                            ) : null}
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
                                                            format={formatGpaPercentageValue}
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
                                                            format={formatGpaPercentageValue}
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
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
                                                            <p className="text-xs tracking-wider text-muted-foreground font-medium">GPA</p>
                                                            <p className="text-lg font-semibold">
                                                                <AnimatedNumber
                                                                    value={semester.average_scaled}
                                                                    format={(val) => val.toFixed(2)}
                                                                />
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs tracking-wider text-muted-foreground font-medium">Average</p>
                                                            <p className="text-lg font-semibold">{formatGpaPercentage(semester.average_percentage)}</p>
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
                                        <div className="absolute right-4 top-4">
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
                                        <AppEmptyState
                                            scenario="create"
                                            size="section"
                                            className="col-span-full"
                                            title="No semesters yet"
                                            description="Create your first semester to start organizing courses and schedules."
                                            primaryAction={program ? (
                                                <CreateSemesterWizardButton
                                                    programId={program.id}
                                                    onChanged={refreshDashboardData}
                                                >
                                                    Create Semester
                                                </CreateSemesterWizardButton>
                                            ) : undefined}
                                        />
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
                                        {/* Search with Suggestions */}
                                        <Combobox<CourseFilterSuggestion, true>
                                            items={suggestions}
                                            multiple
                                            itemToStringValue={(suggestion) => suggestion.label}
                                            isItemEqualToValue={(item, value) => item.type === value.type && item.value === value.value}
                                            onInputValueChange={setCourseSearchQuery}
                                            value={activeFilters}
                                            onValueChange={(value) => {
                                                setActiveFilters(Array.isArray(value) ? value : []);
                                                setCourseSearchQuery('');
                                            }}
                                            autoHighlight
                                        >
                                            <ComboboxChips ref={suggestionsAnchor} className="w-full">
                                                <ComboboxValue>
                                                    {(values) => (
                                                        <>
                                                            {values.map((filter: CourseFilterSuggestion) => (
                                                                <ComboboxChip key={`${filter.type}-${filter.value}`}>
                                                                    {filter.label}
                                                                </ComboboxChip>
                                                            ))}
                                                            <ComboboxChipsInput
                                                                placeholder={values.length > 0 ? 'Add more filters...' : 'Search or filter courses...'}
                                                            />
                                                        </>
                                                    )}
                                                </ComboboxValue>
                                            </ComboboxChips>
                                            <ComboboxContent anchor={suggestionsAnchor}>
                                                <ComboboxEmpty>No items found.</ComboboxEmpty>
                                                <ComboboxList>
                                                    {(suggestion) => {
                                                        const Icon = suggestion.icon;
                                                        return (
                                                            <ComboboxItem
                                                                key={`${suggestion.type}-${suggestion.value}`}
                                                                value={suggestion}
                                                                className="pr-2 [&>span.absolute]:hidden"
                                                            >
                                                                <Icon className="text-muted-foreground" />
                                                                <span>{suggestion.label}</span>
                                                            </ComboboxItem>
                                                        );
                                                    }}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                    </div>
                                </div>
                                <div className="rounded-md border bg-card min-h-[300px] flex flex-col overflow-hidden">
                                    {filteredAndSortedCourses.length === 0 ? (
                                        <AppEmptyState
                                            scenario={courseSearchQuery || activeFilters.length > 0 ? "no-results" : "create"}
                                            size="section"
                                            surface="inherit"
                                            className="flex-1 rounded-none border-0 px-6 py-10"
                                            title={courseSearchQuery || activeFilters.length > 0 ? "No matching courses" : "No courses yet"}
                                            description={courseSearchQuery || activeFilters.length > 0
                                                ? "Adjust the search or filters to see more courses."
                                                : "Add a course to start tracking grades and organization inside this Program."}
                                            primaryAction={courseSearchQuery || activeFilters.length > 0 ? undefined : (
                                                <Button
                                                    type="button"
                                                    onClick={() => setIsCourseModalOpen(true)}
                                                >
                                                    Add Course
                                                </Button>
                                            )}
                                        />
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
                                                                <span>{formatGpaPercentage(course.grade_percentage)}</span>
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
