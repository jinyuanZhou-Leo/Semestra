import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import api from '../../services/api';
import type { Course } from '../../services/api';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';

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

// Memoize to prevent re-renders when parent updates unrelated state
export const CourseList = React.memo(CourseListComponent);

export const CourseListDefinition: WidgetDefinition = {
    type: 'course-list',
    name: 'Course List',
    description: 'Display a list of courses in this semester.',
    icon: '📚',
    component: CourseList,
    maxInstances: 1,
    allowedContexts: ['semester'],
    layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 6, maxH: 6 }
};
