// input:  [semester context id, semester/program API service, router link navigation, plugin-local GPA-percentage formatting, and shared alert/button primitives]
// output: [course-list widget component and plugin definition metadata]
// pos:    [semester-scoped dashboard widget that fetches/render course cards with Program-derived subject-code colors plus explicit loading and retry states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../../services/api';
import type { Course } from '../../services/api';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getCourseBadgeStyle, parseSubjectColorMap, resolveCourseColor } from '@/utils/courseCategoryBadge';
import { formatCourseListGpaPercentage } from './format';

const resolveErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }
    return fallback;
};

/**
 * CourseList Plugin - Memoized for performance
 * Optimistic UI: Fetches fresh data after mutations
 */
const CourseListComponent: React.FC<WidgetProps> = ({ semesterId }) => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [programSubjectColorMap, setProgramSubjectColorMap] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const latestFetchRef = React.useRef(0);

    const loadCourses = React.useCallback(async () => {
        if (!semesterId) {
            setCourses([]);
            setErrorMessage(null);
            setIsLoading(false);
            return;
        }

        const fetchId = latestFetchRef.current + 1;
        latestFetchRef.current = fetchId;
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const data = await api.getSemester(semesterId);
            if (fetchId !== latestFetchRef.current) return;
            setCourses(Array.isArray(data.courses) ? data.courses : []);

            if (data.program_id) {
                try {
                    const program = await api.getProgram(data.program_id);
                    if (fetchId !== latestFetchRef.current) return;
                    setProgramSubjectColorMap(parseSubjectColorMap(program.subject_color_map));
                } catch (programError) {
                    if (fetchId !== latestFetchRef.current) return;
                    console.warn('Failed to load Program subject colors for course list widget', programError);
                    setProgramSubjectColorMap({});
                }
            } else {
                setProgramSubjectColorMap({});
            }
        } catch (error) {
            if (fetchId !== latestFetchRef.current) return;
            console.error('Failed to load course list widget data', error);
            setCourses([]);
            setProgramSubjectColorMap({});
            setErrorMessage(resolveErrorMessage(error, 'Unable to load courses for this semester.'));
        } finally {
            if (fetchId === latestFetchRef.current) {
                setIsLoading(false);
            }
        }
    }, [semesterId]);

    useEffect(() => {
        void loadCourses();
        return () => {
            latestFetchRef.current += 1;
        };
    }, [loadCourses]);

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
                {isLoading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading courses...</span>
                    </div>
                ) : errorMessage ? (
                    <Alert variant="destructive" className="mx-auto max-w-sm">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Could not load courses</AlertTitle>
                        <AlertDescription className="space-y-3">
                            <p>{errorMessage}</p>
                            <Button type="button" variant="outline" size="sm" onClick={() => void loadCourses()}>
                                Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : courses.length === 0 ? (
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
                                            {formatCourseListGpaPercentage(course.grade_percentage)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            {course.category && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px] px-1 py-0 h-4 border-transparent bg-muted text-muted-foreground hover:bg-muted"
                                                    style={getCourseBadgeStyle(resolveCourseColor(course, programSubjectColorMap))}
                                                >
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
    component: CourseList,
};
