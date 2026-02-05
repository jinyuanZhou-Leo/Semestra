import React, { useEffect, useId, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsModal } from '../components/SettingsModal';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Container } from '../components/Container';
import api from '../services/api';
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
import { Settings, Plus, Upload, Search, Trash2, GraduationCap, Percent, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, X, Tag, Calendar, Hash, TrendingUp, Layers } from 'lucide-react';

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

const ProgramDashboardContent: React.FC = () => {
    const { program, updateProgram, refreshProgram, isLoading } = useProgramData();
    const { alert: showAlert, confirm } = useDialog();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
    const [newSemesterName, setNewSemesterName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [courseSearchQuery, setCourseSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
    const [activeFilters, setActiveFilters] = useState<Array<{ type: string; value: string; label: string }>>([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const semesterNameId = useId();

    // Ref to track the latest newSemesterName, avoiding stale closure
    const newSemesterNameRef = useRef(newSemesterName);
    useEffect(() => {
        newSemesterNameRef.current = newSemesterName;
    }, [newSemesterName]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.ics') || file.type === 'text/calendar') {
                setSelectedFile(file);
                // Auto-fill name from filename only if name is empty
                if (!newSemesterNameRef.current) {
                    const name = file.name.replace('.ics', '').replace(/[_-]/g, ' ');
                    setNewSemesterName(name);
                }
            } else {
                await showAlert({
                    title: "Invalid file",
                    description: "Please upload a valid .ics file."
                });
            }
        }
    };

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleCreateSemester = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!program) return;

        setIsSubmitting(true);
        try {
            if (selectedFile) {
                await api.uploadSemesterICS(program.id, selectedFile, newSemesterName || undefined);
            } else {
                await api.createSemester(program.id, {
                    name: newSemesterName
                });
            }
            setIsModalOpen(false);
            setNewSemesterName('');
            setSelectedFile(null);
            refreshProgram();
        } catch (error) {
            console.error("Failed to create semester", error);
            await showAlert({
                title: "Create failed",
                description: "Failed to create semester."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateProgram = async (data: any) => {
        if (!program) return;
        updateProgram(data);
    };

    const totalCredits = React.useMemo(() => {
        if (!program) return 0;
        return program.semesters.reduce(
            (acc, sem: any) => acc + (sem.courses?.reduce((cAcc: number, c: any) => cAcc + c.credits, 0) || 0),
            0
        );
    }, [program]);

    const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

    const filteredSemesters = useMemo(() => {
        if (!program) return [];
        if (!normalizedQuery) return program.semesters;
        return program.semesters.filter(semester =>
            semester.name.toLowerCase().includes(normalizedQuery)
        );
    }, [program, normalizedQuery]);

    // Extract unique values for suggestions
    const suggestions = useMemo(() => {
        if (!program) return [];

        const allCourses = program.semesters.flatMap(sem =>
            (sem.courses || []).map(course => ({
                ...course,
                semesterName: sem.name,
                semesterId: sem.id
            }))
        );

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
    }, [program]);

    // Filter suggestions based on search query
    const filteredSuggestions = useMemo(() => {
        if (!courseSearchQuery.trim()) return suggestions;
        const query = courseSearchQuery.toLowerCase();
        return suggestions.filter(s => s.label.toLowerCase().includes(query));
    }, [suggestions, courseSearchQuery]);

    const filteredAndSortedCourses = useMemo(() => {
        if (!program) return [];

        let courses = program.semesters.flatMap(sem =>
            (sem.courses || []).map(course => ({
                ...course,
                semesterName: sem.name,
                semesterId: sem.id
            }))
        );

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
                        case 'level':
                            const courseLevel = extractCourseLevel(course.name);
                            return courseLevel !== null && String(courseLevel) === filter.value;
                        case 'gpa':
                            const threshold = parseFloat(filter.value);
                            if (threshold === 4.0) {
                                return course.grade_scaled === 4.0;
                            }
                            return course.grade_scaled >= threshold;
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
    }, [program, courseSearchQuery, sortConfig, activeFilters]);

    const getCategoryColor = (category: string) => {
        if (!category) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        const colors = [
            'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
            'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
            'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
            'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
            'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
            'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
            'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
            'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
            'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
            'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
            'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
            'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
            'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
            'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
            'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
        ];
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
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
        setSelectedSuggestionIndex(0);
    };

    const handleRemoveFilter = (index: number) => {
        setActiveFilters(activeFilters.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isSuggestionsOpen || filteredSuggestions.length === 0) {
            if (e.key === 'ArrowDown' && !isSuggestionsOpen) {
                setIsSuggestionsOpen(true);
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
                if (filteredSuggestions[selectedSuggestionIndex]) {
                    handleAddFilter(filteredSuggestions[selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsSuggestionsOpen(false);
                setSelectedSuggestionIndex(0);
                break;
        }
    };



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
                    <Empty className="my-16">
                        <EmptyHeader>
                            <EmptyTitle>Program not found</EmptyTitle>
                            <EmptyDescription>
                                The program you are looking for does not exist or has been deleted.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        </EmptyContent>
                    </Empty>
                </Container>
            </Layout>
        );
    }

    return (
        <Layout breadcrumb={breadcrumb}>
            <div className="border-b bg-background sticky top-[60px] z-20">
                <Container className="py-4 md:py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            {isLoading || !program ? (
                                <Skeleton className="h-8 w-48" />
                            ) : (
                                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-3">
                                        {program.name}
                                    <Button
                                            variant="ghost"
                                        size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => setIsSettingsOpen(true)}
                                    >
                                            <Settings className="h-4 w-4" />
                                    </Button>
                                    </h1>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={() => setIsCourseModalOpen(true)} variant="outline" size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Course
                            </Button>
                            <Button onClick={() => setIsModalOpen(true)} size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Semester
                            </Button>
                        </div>
                    </div>
                </Container>
            </div>

            <Container className="py-8 md:py-10 space-y-10">
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
                                <div className="grid gap-4 md:grid-cols-3">
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
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                                    <Link key={semester.id} to={`/semesters/${semester.id}`}>
                                            <Card className="group h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-lg font-semibold truncate pr-4">
                                                        {semester.name}
                                                    </CardTitle>
                                                    <Button
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const shouldDelete = await confirm({
                                                                title: "Delete semester?",
                                                            description: "Are you sure you want to delete this semester? This action cannot be undone.",
                                                            confirmText: "Delete",
                                                            cancelText: "Cancel",
                                                            tone: "destructive"
                                                        });
                                                            if (!shouldDelete) return;
                                                            api.deleteSemester(semester.id)
                                                                .then(() => refreshProgram())
                                                                .catch(err => console.error("Failed to delete", err));
                                                        }}
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                            </CardHeader>
                                                <CardContent>
                                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                                    <div>
                                                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">GPA</p>
                                                            <p className="text-lg font-semibold">{semester.average_scaled.toFixed(2)}</p>
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
                                ))}
                                    {filteredSemesters.length === 0 && (
                                        <div className="col-span-full border rounded-lg border-dashed p-8 text-center">
                                            <p className="text-muted-foreground">No semesters found</p>
                                            <Button variant="link" onClick={() => setIsModalOpen(true)} className="mt-2 text-primary">
                                                Create one
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* All Courses Section */}
                            <section className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <h2 className="text-lg font-semibold tracking-tight">
                                        All Courses
                                    </h2>
                                    <div className="flex-1 max-w-sm space-y-3">
                                        {/* Active Filters */}
                                        {activeFilters.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {activeFilters.map((filter, index) => (
                                                    <Badge
                                                        key={index}
                                                        variant="secondary"
                                                        className="pl-2.5 pr-1.5 py-1 text-xs font-medium flex items-center gap-1.5"
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
                                                            setSelectedSuggestionIndex(0);
                                                        }}
                                                        onFocus={() => setIsSuggestionsOpen(true)}
                                                        onBlur={(e) => {
                                                            // Don't close if clicking inside the popover content
                                                            const relatedTarget = e.relatedTarget as HTMLElement | null;
                                                            if (relatedTarget?.closest('[data-radix-popper-content-wrapper]')) {
                                                                return;
                                                            }
                                                            setIsSuggestionsOpen(false);
                                                            setSelectedSuggestionIndex(0);
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
                                                    setSelectedSuggestionIndex(0);
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
                                                                            className={`cursor-pointer ${index === selectedSuggestionIndex
                                                                                ? 'bg-accent'
                                                                                : ''
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
                                <div className="rounded-md border bg-card min-h-[300px] flex flex-col">
                                    {filteredAndSortedCourses.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                            {courseSearchQuery || activeFilters.length > 0 ? "No courses found matching your search." : "No courses added yet."}
                                        </div>
                                    ) : (
                                    <Table>
                                        <TableHeader>
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
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                                    {filteredAndSortedCourses.map(course => (
                                                    <TableRow key={course.id}>
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
                                                                        className={`border-0 font-medium ${getCategoryColor(course.category)}`}
                                                                >
                                                                    {course.category}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            <Link to={`/semesters/${course.semesterId}`} className="hover:underline">
                                                                {course.semesterName}
                                                            </Link>
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
                                                                    {course.grade_scaled.toFixed(2)}
                                                                </span>
                                                            )}
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

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Semester</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateSemester} className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor={semesterNameId}>Semester Name</Label>
                            <Input
                                id={semesterNameId}
                                placeholder="e.g. Fall 2025"
                                value={newSemesterName}
                                onChange={(e) => setNewSemesterName(e.target.value)}
                                required={!selectedFile}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Import Schedule (Optional)</Label>
                            <div
                                className={`
                                    border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
                                    ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                                `}
                                onClick={() => document.getElementById('ics-upload')?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    id="ics-upload"
                                    accept=".ics"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setSelectedFile(file);
                                            if (!newSemesterNameRef.current) {
                                                const name = file.name.replace('.ics', '').replace(/[_-]/g, ' ');
                                                setNewSemesterName(name);
                                            }
                                        }
                                    }}
                                />
                                <div className="flex flex-col items-center gap-2">
                                    {selectedFile ? (
                                        <div className="flex items-center gap-2 text-primary font-medium">
                                            <Upload className="h-5 w-5" />
                                            {selectedFile.name}
                                        </div>
                                    ) : (
                                        <>
                                                <Upload className="h-8 w-8 text-muted-foreground/50" />
                                                <div className="text-sm text-muted-foreground">
                                                    Click or drag .ics file to upload
                                                </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : (selectedFile ? 'Upload & Create' : 'Create Semester')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {program && (
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    title="Program Settings"
                    initialName={program.name}
                    initialSettings={{
                        grad_requirement_credits: program.grad_requirement_credits,
                        gpa_scaling_table: program.gpa_scaling_table,
                        hide_gpa: program.hide_gpa
                    }}
                    onSave={handleUpdateProgram}
                    type="program"
                />
            )}

            {program && (
                <CourseManagerModal
                    isOpen={isCourseModalOpen}
                    onClose={() => setIsCourseModalOpen(false)}
                    programId={program.id}
                    onCourseAdded={refreshProgram}
                />
            )}
        </Layout>
    );
};

export const ProgramDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container>
                    <Empty className="my-16">
                        <EmptyHeader>
                            <EmptyTitle>Program not found</EmptyTitle>
                            <EmptyDescription>No program ID provided.</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        </EmptyContent>
                    </Empty>
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
