import React, { useState } from 'react';
import { Button } from './Button';
import { CourseManagerModal } from './CourseManagerModal';
import api, { type Course } from '../services/api';
import { SettingsSection } from './SettingsSection';

interface SemesterCoursesSettingsProps {
    semesterId: string;
    programId: string;
    courses: Course[];
    onRefresh: () => void;
}

export const SemesterCoursesSettings: React.FC<SemesterCoursesSettingsProps> = ({
    semesterId,
    programId,
    courses,
    onRefresh
}) => {
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    const handleRemoveCourse = async (courseId: string) => {
        if (!window.confirm("Are you sure you want to remove this course from the semester? It will remain in the program.")) {
            return;
        }
        try {
            // Unassign from semester by setting semester_id to null (or we could have a specific endpoint)
            // Using updateCourse to set semester_id to null.
            // Note: Our API might expect `null` or empty string. Let's send null.
            // Typescript might complain if partial Course expects string | undefined. 
            // We might need to cast or ensure backend handles it.
            // Let's assume sending null for semester_id unassigns it.
            await api.updateCourse(courseId, { semester_id: null as any });
            onRefresh();
        } catch (error) {
            console.error("Failed to remove course", error);
        }
    };

    return (
        <SettingsSection
            title="Courses"
            description="Manage courses assigned to this semester."
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    {courses.length === 0 ? (
                        <div style={{ padding: '1rem', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                            No courses assigned.
                        </div>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {courses.map(course => (
                                <li key={course.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem',
                                    borderBottom: '1px solid var(--color-border)',
                                    background: 'var(--color-bg-secondary)'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{course.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                            {course.credits} Credits • {course.grade_percentage}%
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handleRemoveCourse(course.id)}
                                        style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                                    >
                                        Remove
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <Button onClick={() => setIsManagerOpen(true)}>
                    + Add / Manage Courses
                </Button>

                <CourseManagerModal
                    isOpen={isManagerOpen}
                    onClose={() => setIsManagerOpen(false)}
                    programId={programId}
                    semesterId={semesterId}
                    onCourseAdded={() => {
                        onRefresh();
                        // Keep modal open or closed? Usually keep open if adding multiple? 
                        // But onCourseAdded triggers refresh. 
                        // Let's keep it open? Or let user close.
                    }}
                />
            </div>
        </SettingsSection>
    );
};
