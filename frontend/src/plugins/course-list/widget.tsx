import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import api from '../../services/api';
import type { Course, Semester } from '../../services/api';
import type { WidgetDefinition, WidgetProps, WidgetGlobalSettingsProps } from '../../services/widgetRegistry';
import { Button } from '@/components/ui/button';
import { CourseManagerModal } from '../../components/CourseManagerModal';
import { SettingsSection } from '../../components/SettingsSection';
import { Card, CardContent } from '@/components/ui/card';
import { useDialog } from '../../contexts/DialogContext';

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
        <div className="flex h-full flex-col select-none">
            <div className="course-list-scroll flex-1 overflow-y-auto">
                {courses.length === 0 ? (
                    <div className="mt-4 text-center text-sm text-muted-foreground">No courses</div>
                ) : (
                    <div className="space-y-3">
                        {courses.map(course => (
                            <Card key={course.id} className="rounded-[var(--radius-widget)] border-border/60 bg-card/90 shadow-sm">
                                <CardContent className="flex items-center justify-between gap-4 p-4">
                                    <div className="min-w-0">
                                        <Link
                                            to={`/courses/${course.id}`}
                                            className="text-base font-semibold text-foreground transition hover:underline"
                                        >
                                            {course.name}
                                        </Link>
                                        {course.alias && (
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {course.alias}
                                            </div>
                                        )}
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            {Number(course.credits).toFixed(2)} Credits
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-semibold text-foreground">
                                            {course.grade_percentage}%
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            GPA: {Number.isFinite(course.grade_scaled) ? course.grade_scaled.toFixed(2) : '0.00'}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
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
    const { confirm } = useDialog();

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
        const shouldRemove = await confirm({
            title: "Remove course?",
            description: "Are you sure you want to remove this course from the semester? It will remain in the program.",
            confirmText: "Remove",
            cancelText: "Cancel",
            tone: "destructive"
        });
        if (!shouldRemove) return;
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
