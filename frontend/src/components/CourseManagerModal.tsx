import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api, { type Course } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
                className="p-0 sm:max-w-[600px]"
                style={{ height: '100%', minHeight: '400px' }}
            >
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle className="text-base font-semibold">Manage Courses</DialogTitle>
                </DialogHeader>
                <div className="p-6" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px' }}>
                {/* Mode Switcher (only if semesterId is present) */}
                {semesterId && (
                    <div style={{ marginBottom: '1.5rem' }}>
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

                <AnimatePresence mode="wait">
                    {mode === 'list' && semesterId ? (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
                        >
                            <div className="relative mb-4">
                                <span
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        width="16"
                                        height="16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </span>
                                <Input
                                    placeholder="Search unassigned courses..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                paddingRight: '0.5rem'
                            }}>
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
                                    filteredCourses.map(course => (
                                        <div key={course.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '1rem',
                                            background: 'var(--color-bg-secondary)',
                                            borderRadius: 'var(--radius-lg)',
                                            border: '1px solid var(--color-border)',
                                            transition: 'transform 0.2s, box-shadow 0.2s'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{course.name}</div>
                                                {course.alias && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '0.25rem' }}>
                                                        {course.alias}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <span style={{ opacity: 0.7 }}>Credits:</span> {course.credits}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <span style={{ opacity: 0.7 }}>Grade:</span> {course.grade_percentage}%
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handleAddExisting(course.id)}
                                                style={{ whiteSpace: 'nowrap' }}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="create"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                                style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
                        >
                                <form onSubmit={handleCreateNew} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div className="grid gap-2">
                                        <Label htmlFor="course-name">Course Name</Label>
                                        <Input
                                            id="course-name"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            required
                                            placeholder="e.g. Introduction to Computer Science"
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
                                </div>

                                    <div style={{ flex: 1 }} />

                                    <Button type="submit" style={{ width: '100%' }}>
                                        Create Course
                                    </Button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
};
