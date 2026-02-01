import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';
import type { Semester, Course, Widget, Tab } from '../services/api';
import { useDataFetch } from '../hooks/useDataFetch';

type SemesterWithDetails = Semester & { courses: Course[]; widgets?: Widget[]; tabs?: Tab[] };

interface SemesterDataContextType {
    semester: SemesterWithDetails | null;
    setSemester: React.Dispatch<React.SetStateAction<SemesterWithDetails | null>>;
    updateSemester: (updates: Partial<Semester>) => void;
    refreshSemester: () => Promise<void>;
    isLoading: boolean;
}

const SemesterDataContext = createContext<SemesterDataContextType | undefined>(undefined);

export const useSemesterData = () => {
    const context = useContext(SemesterDataContext);
    if (context === undefined) {
        throw new Error('useSemesterData must be used within a SemesterDataProvider');
    }
    return context;
};

interface SemesterDataProviderProps {
    semesterId: string;
    children: React.ReactNode;
}

export const SemesterDataProvider: React.FC<SemesterDataProviderProps> = ({ semesterId, children }) => {
    const pendingUpdates = useRef<Record<string, any>>({});
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchFn = useCallback(() => api.getSemester(semesterId), [semesterId]);

    const {
        data: semester,
        setData: setSemester,
        isLoading,
        silentRefresh
    } = useDataFetch<SemesterWithDetails>({
        fetchFn,
        enabled: !!semesterId
    });

    const syncToBackend = useCallback(async () => {
        if (!semesterId || Object.keys(pendingUpdates.current).length === 0) return;

        const updates = { ...pendingUpdates.current };
        pendingUpdates.current = {};

        try {
            await api.updateSemester(semesterId, updates);
        } catch (error) {
            console.error("Failed to sync semester to backend", error);
            pendingUpdates.current = { ...updates, ...pendingUpdates.current };
        }
    }, [semesterId]);

    const updateSemester = useCallback((updates: Partial<Semester>) => {
        setSemester(prev => {
            if (!prev) return prev;
            return { ...prev, ...updates };
        });

        pendingUpdates.current = { ...pendingUpdates.current, ...updates };

        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = setTimeout(() => {
            syncToBackend();
        }, 1000);
    }, [syncToBackend, setSemester]);

    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
            if (Object.keys(pendingUpdates.current).length > 0 && semesterId) {
                api.updateSemester(semesterId, pendingUpdates.current).catch(console.error);
            }
        };
    }, [semesterId]);

    const value: SemesterDataContextType = {
        semester,
        setSemester,
        updateSemester,
        refreshSemester: silentRefresh,
        isLoading
    };

    return (
        <SemesterDataContext.Provider value={value}>
            {children}
        </SemesterDataContext.Provider>
    );
};
