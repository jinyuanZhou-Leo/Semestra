// input:  [course ID, course fetch/update API functions, generic `useEntityContext` hook]
// output: [`CourseDataProvider`, `useCourseData()`, and `CourseWithDetails` type]
// pos:    [Course-level data context with optimistic updates and refresh abstraction]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import api from '../services/api';
import type { Course, Widget, Tab } from '../services/api';
import { useEntityContext } from '../hooks/useEntityContext';

export type CourseWithDetails = Course & {
    widgets?: Widget[];
    tabs?: Tab[];
    hide_gpa?: boolean;
};

interface CourseDataContextType {
    course: CourseWithDetails | null;
    setCourse: React.Dispatch<React.SetStateAction<CourseWithDetails | null>>;
    updateCourse: (updates: Partial<CourseWithDetails>) => void;
    refreshCourse: () => Promise<void>;
    isLoading: boolean;
}

const CourseDataContext = createContext<CourseDataContextType | undefined>(undefined);

export const useCourseData = () => {
    const context = useContext(CourseDataContext);
    if (context === undefined) {
        throw new Error('useCourseData must be used within a CourseDataProvider');
    }
    return context;
};

interface CourseDataProviderProps {
    courseId: string;
    children: React.ReactNode;
}

export const CourseDataProvider: React.FC<CourseDataProviderProps> = ({ courseId, children }) => {
    const fetchFn = useCallback((id: string) => api.getCourse(id), []);
    const updateFn = useCallback((id: string, updates: Partial<CourseWithDetails>) => api.updateCourse(id, updates), []);

    const {
        data: course,
        setData: setCourse,
        updateData: updateCourse,
        refresh: refreshCourse,
        isLoading
    } = useEntityContext<CourseWithDetails>({
        entityId: courseId,
        fetchFn,
        updateFn
    });

    const value: CourseDataContextType = useMemo(() => ({
        course,
        setCourse,
        updateCourse,
        refreshCourse,
        isLoading
    }), [course, setCourse, updateCourse, refreshCourse, isLoading]);

    return (
        <CourseDataContext.Provider value={value}>
            {children}
        </CourseDataContext.Provider>
    );
};
