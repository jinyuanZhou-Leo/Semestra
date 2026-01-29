import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';
import type { Course, Tab } from '../services/api';
import { useDataFetch } from '../hooks/useDataFetch';

interface CourseWithWidgets extends Course {
    widgets?: any[];
    hide_gpa?: boolean;
    tabs?: Tab[];
}

interface CourseDataContextType {
    course: CourseWithWidgets | null;
    setCourse: React.Dispatch<React.SetStateAction<CourseWithWidgets | null>>;
    updateCourseField: (field: string, value: any) => void;
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
    const pendingUpdates = useRef<Record<string, any>>({});
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchFn = useCallback(() => api.getCourse(courseId), [courseId]);

    const {
        data: course,
        setData: setCourse,
        isLoading,
        silentRefresh
    } = useDataFetch<CourseWithWidgets>({
        fetchFn,
        enabled: !!courseId
    });

    // Debounced sync to backend
    const syncToBackend = useCallback(async () => {
        if (!courseId || Object.keys(pendingUpdates.current).length === 0) return;

        const updates = { ...pendingUpdates.current };
        pendingUpdates.current = {};

        try {
            await api.updateCourse(courseId, updates);
        } catch (error) {
            console.error("Failed to sync course to backend", error);
            // On error, merge updates back to pending
            pendingUpdates.current = { ...updates, ...pendingUpdates.current };
        }
    }, [courseId]);

    const updateCourseField = useCallback((field: string, value: any) => {
        // Update local state immediately for reactive UI
        setCourse(prev => {
            if (!prev) return prev;
            return { ...prev, [field]: value };
        });

        // Queue update for backend sync
        pendingUpdates.current[field] = value;

        // Debounce backend sync (1 second)
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = setTimeout(() => {
            syncToBackend();
        }, 1000);
    }, [syncToBackend, setCourse]);

    // Cleanup on unmount - ensure pending updates are synced
    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
            // Sync any pending updates before unmount
            if (Object.keys(pendingUpdates.current).length > 0 && courseId) {
                api.updateCourse(courseId, pendingUpdates.current).catch(console.error);
            }
        };
    }, [courseId]);

    const value: CourseDataContextType = {
        course,
        setCourse,
        updateCourseField,
        refreshCourse: silentRefresh,
        isLoading
    };

    return (
        <CourseDataContext.Provider value={value}>
            {children}
        </CourseDataContext.Provider>
    );
};
