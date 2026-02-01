import React, { createContext, useContext, useCallback } from 'react';
import api from '../services/api';
import type { Semester, Course, Widget, Tab } from '../services/api';
import { useEntityContext } from '../hooks/useEntityContext';

export type SemesterWithDetails = Semester & {
    courses: Course[];
    widgets?: Widget[];
    tabs?: Tab[];
};

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
    const fetchFn = useCallback((id: string) => api.getSemester(id), []);
    const updateFn = useCallback((id: string, updates: Partial<SemesterWithDetails>) => api.updateSemester(id, updates), []);

    const {
        data: semester,
        setData: setSemester,
        updateData: updateSemester,
        refresh: refreshSemester,
        isLoading
    } = useEntityContext<SemesterWithDetails>({
        entityId: semesterId,
        fetchFn,
        updateFn
    });

    const value: SemesterDataContextType = {
        semester,
        setSemester,
        updateSemester,
        refreshSemester,
        isLoading
    };

    return (
        <SemesterDataContext.Provider value={value}>
            {children}
        </SemesterDataContext.Provider>
    );
};
