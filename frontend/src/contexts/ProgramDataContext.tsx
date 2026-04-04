// input:  [program ID, program fetch/update API calls, app-side Program query keys, and query-backed entity context]
// output: [`ProgramDataProvider` and `useProgramData()` context APIs]
// pos:    [Program-level optimistic context with query-cache-backed queued backend synchronization and longer-lived entity detail reuse across workspace re-entry]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Program, Semester } from '../services/api';
import { programKeys } from '@/data/keys';
import { useEntityContext } from '../hooks/useEntityContext';
import { getProgramInitialData } from './entityContextInitialData';

type ProgramWithSemesters = Program & { semesters: Semester[] };

interface ProgramDataContextType {
    program: ProgramWithSemesters | null;
    setProgram: React.Dispatch<React.SetStateAction<ProgramWithSemesters | null>>;
    updateProgram: (updates: Partial<Program>) => void;
    saveProgram: (updates: Partial<Program>) => Promise<void>;
    refreshProgram: () => Promise<void>;
    isLoading: boolean;
}

const ProgramDataContext = createContext<ProgramDataContextType | undefined>(undefined);

export const useProgramData = () => {
    const context = useContext(ProgramDataContext);
    if (context === undefined) {
        throw new Error('useProgramData must be used within a ProgramDataProvider');
    }
    return context;
};

interface ProgramDataProviderProps {
    programId: string;
    children: React.ReactNode;
}

export const ProgramDataProvider: React.FC<ProgramDataProviderProps> = ({ programId, children }) => {
    const queryClient = useQueryClient();
    const fetchFn = useCallback((id: string) => api.getProgram(id), []);
    const updateFn = useCallback((id: string, updates: Partial<ProgramWithSemesters>) => api.updateProgram(id, updates), []);
    const initialData = useMemo(() => getProgramInitialData(queryClient, programId), [programId, queryClient]);

    const {
        data: program,
        setData: setProgram,
        updateData: updateProgram,
        commitData: saveProgram,
        refresh: refreshProgram,
        isLoading
    } = useEntityContext<ProgramWithSemesters>({
        entityId: programId,
        queryKey: programKeys.detail(programId),
        fetchFn,
        updateFn,
        staleTimeMs: 300_000,
        initialData: initialData?.data,
        initialDataUpdatedAt: initialData?.updatedAt,
    });

    const value: ProgramDataContextType = useMemo(() => ({
        program,
        setProgram,
        updateProgram,
        saveProgram,
        refreshProgram,
        isLoading
    }), [program, setProgram, updateProgram, saveProgram, refreshProgram, isLoading]);

    return (
        <ProgramDataContext.Provider value={value}>
            {children}
        </ProgramDataContext.Provider>
    );
};
