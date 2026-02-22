"use no memo";

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import api from '../../services/api';
import type { Course } from '../../services/api';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';
import { Badge } from '@/components/ui/badge';

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
        return (
            <div className="flex h-full items-center justify-center p-3 text-xs text-muted-foreground">
                Select a semester
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col p-3">
            <div className="course-list-scroll no-scrollbar flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {courses.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No courses</div>
                ) : (
                        <div className="flex flex-col gap-1.5">
                            {courses.map(course => (
                                <Link
                                    key={course.id}
                                    to={`/courses/${course.id}`}
                                    className="group flex flex-col gap-1 rounded-md border border-transparent bg-muted/40 px-2.5 py-0.5 transition-all hover:border-border hover:bg-muted"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="line-clamp-1 text-sm font-medium leading-none text-foreground/90 group-hover:text-primary transition-colors">
                                            {course.name}
                                        </span>
                                        <span className="text-sm font-semibold tabular-nums leading-none">
                                            {course.grade_percentage}%
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            {course.category && (
                                                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 border-transparent bg-muted text-muted-foreground hover:bg-muted">
                                                    {course.category}
                                                </Badge>
                                            )}
                                        {course.alias && (
                                                <span className="font-medium">{course.alias}</span>
                                        )}
                                            {course.alias && <span>•</span>}
                                            <span>{Number(course.credits).toFixed(1)} cr</span>
                                        </div>
                                        <div className="font-medium tabular-nums opacity-70">
                                            GPA: {Number.isFinite(course.grade_scaled) ? course.grade_scaled.toFixed(2) : '0.00'}
                                        </div>
                                    </div>
                                </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
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
    layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 6, maxH: 6 }
};
