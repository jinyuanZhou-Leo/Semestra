import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import api from '../../services/api';
import type { Course, Semester } from '../../services/api';
import type { WidgetDefinition, WidgetProps, WidgetGlobalSettingsProps } from '../../services/widgetRegistry';
import { Button } from '../../components/Button';
import { CourseManagerModal } from '../../components/CourseManagerModal';
import { SettingsSection } from '../../components/SettingsSection';

/**
 * CourseList Plugin - Memoized for performance
 * Optimistic UI: Fetches fresh data after mutations
 */
const CourseListComponent: React.FC<WidgetProps> = ({ semesterId }) => {
    const [courses, setCourses] = useState<Course[]>([]);
    const fetchCourses = useCallback(async () => {
        if (!semesterId) return;
        const data = await api.getSemester(semesterId);
        if (data.courses) setCourses(data.courses);
    }, [semesterId]);

    useEffect(() => {
        if (semesterId) {
            fetchCourses();
        }
    }, [semesterId, fetchCourses]);

    if (!semesterId) {
        return <div>Course List requires a semester context.</div>;
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {courses.length === 0 ? (
                    <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: '1rem' }}>No courses</div>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {courses.map(course => (
                            <li key={course.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '0.75rem',
                                borderBottom: '1px solid var(--color-border)',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 500 }}>
                                        <Link
                                            to={`/courses/${course.id}`}
                                            style={{ color: 'var(--color-text-primary)', textDecoration: 'none' }}
                                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                        >
                                            {course.name}
                                        </Link>
                                    </div>
                                    {course.alias && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.125rem' }}>
                                            {course.alias}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{Number(course.credits).toFixed(2)} Credits</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600 }}>{course.grade_percentage}%</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                            GPA: {Number.isFinite(course.grade_scaled) ? course.grade_scaled.toFixed(2) : '0.00'}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

/**
 * Global settings component for Course List plugin.
 * This is rendered in the Settings tab and manages courses for the semester.
 */
const CourseListGlobalSettings: React.FC<WidgetGlobalSettingsProps> = ({ semesterId, onRefresh }) => {
    const [semester, setSemester] = useState<Semester | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    const fetchSemester = useCallback(async () => {
        if (!semesterId) return;
        try {
            const data = await api.getSemester(semesterId);
            setSemester(data);
        } catch (error) {
            console.error('Failed to fetch semester', error);
        }
    }, [semesterId]);

    useEffect(() => {
        fetchSemester();
    }, [fetchSemester]);

    const handleRemoveCourse = async (courseId: string) => {
        if (!window.confirm("Are you sure you want to remove this course from the semester? It will remain in the program.")) {
            return;
        }
        try {
            await api.updateCourse(courseId, { semester_id: null as any });
            fetchSemester();
            onRefresh();
        } catch (error) {
            console.error("Failed to remove course", error);
        }
    };

    const handleCourseAdded = () => {
        fetchSemester();
        onRefresh();
    };

    if (!semesterId) {
        return <div style={{ color: 'var(--color-text-tertiary)' }}>Semester context required.</div>;
    }

    const courses = semester?.courses || [];
    const programId = semester?.program_id || '';

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
                            {courses.map((course: Course) => (
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
                                        {course.alias && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '0.125rem' }}>
                                                {course.alias}
                                            </div>
                                        )}
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
                    onCourseAdded={handleCourseAdded}
                />
            </div>
        </SettingsSection>
    );
};

export const CourseList = CourseListComponent;

export const CourseListDefinition: WidgetDefinition = {
    type: 'course-list',
    name: 'Course List',
    description: 'Display a list of courses in this semester.',
    icon: '📚',
    component: CourseList,
    maxInstances: 1,
    allowedContexts: ['semester'],
    layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 6, maxH: 6 },
    globalSettingsComponent: CourseListGlobalSettings
};
