import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api, { type Course } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const defaultCredit = (user as any)?.default_course_credit?.toString() || '0.5';

    const [mode, setMode] = useState<'list' | 'create'>(semesterId ? 'list' : 'create');
    const [unassignedCourses, setUnassignedCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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

    useEffect(() => {
        if (isOpen) {
            setNewCredits(defaultCredit);
            if (semesterId) {
                // If opening in a semester, default to list but fetch data
                setMode('list');
                fetchUnassigned();
            } else {
                // If just creating (e.g. from program dashboard), direct to create
                setMode('create');
            }
        }
    }, [isOpen, semesterId, fetchUnassigned]);

    const handleAddExisting = async (courseId: string) => {
        try {
            await api.updateCourse(courseId, { semester_id: semesterId });
            onCourseAdded();
            fetchUnassigned(); // Refresh list
        } catch (error) {
            console.error("Failed to add course to semester", error);
        }
    };

    const handleCreateNew = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
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
        }
    };

    const filteredCourses = unassignedCourses.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="p-0 sm:max-w-[600px] h-[80vh] flex flex-col overflow-hidden"
            >
                <DialogHeader className="border-b px-6 py-4 flex-none">
                    <DialogTitle className="text-base font-semibold">Manage Courses</DialogTitle>
                </DialogHeader>
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    {/* Mode Switcher (only if semesterId is present) */}
                    {semesterId && (
                        <div className="mb-6 flex-none">
                            <Tabs value={mode} onValueChange={(value) => setMode(value as 'list' | 'create')}>
                                <TabsList className="w-full">
                                    <TabsTrigger
                                        value="list"
                                        className="flex-1"
                                    >
                                        Select Existing
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="create"
                                        className="flex-1"
                                    >
                                        Create New
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    )}

                    {mode === 'list' && semesterId ? (
                        <div className="flex flex-col flex-1 overflow-hidden gap-4">
                            <div className="relative flex-none">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search unassigned courses..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            <div className="flex-1 -mr-4 pr-4 overflow-y-auto">
                                {isLoading ? (
                                    <Empty className="border-border/70 bg-muted/40">
                                        <EmptyHeader>
                                            <EmptyTitle>Loading...</EmptyTitle>
                                            <EmptyDescription>Fetching unassigned courses.</EmptyDescription>
                                        </EmptyHeader>
                                        <Spinner className="size-5 text-muted-foreground" />
                                    </Empty>
                                ) : filteredCourses.length === 0 ? (
                                    <Empty className="border-border/70 bg-muted/40">
                                        <EmptyHeader>
                                            <EmptyTitle>No courses found</EmptyTitle>
                                            <EmptyDescription>
                                                {searchTerm ? 'Try a different search term.' : 'All courses are assigned to semesters.'}
                                            </EmptyDescription>
                                        </EmptyHeader>
                                    </Empty>
                                ) : (
                                            <div className="space-y-3">
                                                {filteredCourses.map(course => (
                                                    <div key={course.id} className={cn(
                                                        "flex items-center justify-between p-4",
                                                        "bg-card rounded-lg border shadow-sm transition-all",
                                                        "hover:border-primary/50"
                                                    )}>
                                                        <div className="min-w-0 flex-1 mr-4">
                                                            <div className="font-semibold truncate mb-1">{course.name}</div>
                                                            {course.alias && (
                                                                <div className="text-xs text-muted-foreground truncate mb-1">
                                                                    {course.alias}
                                                                </div>
                                                            )}
                                                            <div className="flex gap-4 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <span className="opacity-70">Credits:</span> {course.credits}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <span className="opacity-70">Grade:</span> {course.grade_percentage}%
                                                                </span>
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
                                )}
                            </div>
                        </div>
                    ) : (
                            <div className="flex flex-col flex-1 overflow-y-auto">
                                <form onSubmit={handleCreateNew} className="flex flex-col flex-1 gap-6">
                                    <div className="grid gap-2">
                                        <Label htmlFor="course-name">Course Name</Label>
                                        <Input
                                            id="course-name"
                                            value={newName}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setNewName(val);
                                                // Simple auto-detect if category is empty
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
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

                                    <div className="mt-auto pt-6">
                                        <Button type="submit" className="w-full">
                                            <Plus className="mr-2 h-4 w-4" />
                                        Create Course
                                        </Button>
                                    </div>
                            </form>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
