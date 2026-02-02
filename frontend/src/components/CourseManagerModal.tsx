import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { TabSwitch } from './TabSwitch';
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Courses"
            maxWidth="600px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px' }}>
                {/* Mode Switcher (only if semesterId is present) */}
                {semesterId && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <TabSwitch
                            value={mode}
                            onChange={setMode}
                            options={[
                                { value: 'list' as const, label: 'Select Existing' },
                                { value: 'create' as const, label: 'Create New' }
                            ]}
                        />
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
                            <Input
                                placeholder="Search unassigned courses..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ marginBottom: '1rem' }}
                            />

                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                paddingRight: '0.5rem'
                            }}>
                                {isLoading ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>
                                ) : filteredCourses.length === 0 ? (
                                    <div style={{
                                        padding: '3rem 1rem',
                                        textAlign: 'center',
                                        color: 'var(--color-text-secondary)',
                                        background: 'var(--color-bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px dashed var(--color-border)'
                                    }}>
                                        <div style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>No courses found</div>
                                        <div style={{ fontSize: '0.85rem' }}>
                                            {searchTerm ? 'Try a different search term' : 'All courses are assigned to semesters'}
                                        </div>
                                    </div>
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
                                    <Input
                                        label="Course Name"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        required
                                            placeholder="e.g. Introduction to Computer Science"
                                        />
                                        <Input
                                            label="Alias (optional)"
                                            value={newAlias}
                                            onChange={e => setNewAlias(e.target.value)}
                                            placeholder="e.g. CS101 - Prof. Smith"
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                            <Input
                                                label="Credits"
                                                type="number"
                                                step="0.5"
                                                value={newCredits}
                                                onChange={e => setNewCredits(e.target.value)}
                                                required
                                            />
                                            <Input
                                                label="Grade (%)"
                                                type="number"
                                                step="0.1"
                                                value={newGrade}
                                                onChange={e => setNewGrade(e.target.value)}
                                                required
                                            />
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
        </Modal>
    );
};
