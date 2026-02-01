import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import api, { type Course } from '../services/api';

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
    const [mode, setMode] = useState<'list' | 'create'>(semesterId ? 'list' : 'create');
    const [unassignedCourses, setUnassignedCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Create Form State
    const [newName, setNewName] = useState('');
    const [newCredits, setNewCredits] = useState('0.5');
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
            if (semesterId) {
                await api.createCourse(semesterId, {
                    name: newName,
                    credits: parseFloat(newCredits),
                    grade_percentage: parseFloat(newGrade),
                    program_id: programId
                });
            } else {
                await api.createCourseForProgram(programId, {
                    name: newName,
                    credits: parseFloat(newCredits),
                    grade_percentage: parseFloat(newGrade),
                    program_id: programId
                });
            }
            onCourseAdded();
            if (semesterId) {
                setMode('list');
                fetchUnassigned();
            } else {
                onClose();
            }
            setNewName('');
            setNewCredits('0.5');
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
                    <div style={{
                        display: 'flex',
                        padding: '0.25rem',
                        background: 'var(--color-bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: '1.5rem'
                    }}>
                        <button
                            onClick={() => setMode('list')}
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                background: mode === 'list' ? 'var(--color-bg-primary)' : 'transparent',
                                color: mode === 'list' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                boxShadow: mode === 'list' ? 'var(--shadow-sm)' : 'none',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                transition: 'all 0.2s'
                            }}
                        >
                            Select Existing
                        </button>
                        <button
                            onClick={() => setMode('create')}
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                background: mode === 'create' ? 'var(--color-bg-primary)' : 'transparent',
                                color: mode === 'create' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                boxShadow: mode === 'create' ? 'var(--shadow-sm)' : 'none',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                transition: 'all 0.2s'
                            }}
                        >
                            Create New
                        </button>
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
                        >
                            <form onSubmit={handleCreateNew} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <Input
                                        label="Course Name"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        required
                                        placeholder="e.g. Introduction to Computer Science"
                                        style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                                    />
                                </div>
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

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    {(semesterId || mode === 'create') && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => semesterId ? setMode('list') : onClose()}
                                            style={{ flex: 1 }}
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                    <Button type="submit" style={{ flex: 2 }}>
                                        Create Course
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Modal>
    );
};
