import React, { createContext, useContext, useCallback, useRef, useEffect, useMemo } from 'react';
import api from '../services/api';
import type { Program, Semester } from '../services/api';
import { useDataFetch } from '../hooks/useDataFetch';
import { reportError } from '../services/appStatus';

type ProgramWithSemesters = Program & { semesters: Semester[] };

interface ProgramDataContextType {
    program: ProgramWithSemesters | null;
    setProgram: React.Dispatch<React.SetStateAction<ProgramWithSemesters | null>>;
    updateProgram: (updates: Partial<Program>) => void;
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
    const pendingUpdates = useRef<Record<string, any>>({});
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncSeqRef = useRef(0);

    const fetchFn = useCallback(() => api.getProgram(programId), [programId]);

    const {
        data: program,
        setData: setProgram,
        isLoading,
        silentRefresh
    } = useDataFetch<ProgramWithSemesters>({
        fetchFn,
        enabled: !!programId
    });

    const syncToBackend = useCallback(async () => {
        if (!programId || Object.keys(pendingUpdates.current).length === 0) return;

        const updates = { ...pendingUpdates.current };
        pendingUpdates.current = {};
        const syncSeq = ++syncSeqRef.current;

        try {
            const result = await api.updateProgram(programId, updates);
            if (syncSeq === syncSeqRef.current && Object.keys(pendingUpdates.current).length === 0) {
                setProgram(prev => {
                    if (!prev) return result as ProgramWithSemesters;
                    return { ...prev, ...result };
                });
            }
        } catch (error) {
            console.error("Failed to sync program to backend", error);
            pendingUpdates.current = { ...updates, ...pendingUpdates.current };
            reportError('Failed to sync program changes. Will retry.');
        }
    }, [programId, setProgram]);

    const updateProgram = useCallback((updates: Partial<Program>) => {
        setProgram(prev => {
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
    }, [syncToBackend, setProgram]);

    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
            if (Object.keys(pendingUpdates.current).length > 0 && programId) {
                api.updateProgram(programId, pendingUpdates.current)
                    .then((result) => {
                        setProgram(prev => {
                            if (!prev) return result as ProgramWithSemesters;
                            return { ...prev, ...result };
                        });
                    })
                    .catch((error) => {
                        console.error("Failed to flush program updates", error);
                        reportError('Failed to sync program changes. Please retry.');
                    });
            }
        };
    }, [programId, setProgram]);

    const value: ProgramDataContextType = useMemo(() => ({
        program,
        setProgram,
        updateProgram,
        refreshProgram: silentRefresh,
        isLoading
    }), [program, setProgram, updateProgram, silentRefresh, isLoading]);

    return (
        <ProgramDataContext.Provider value={value}>
            {children}
        </ProgramDataContext.Provider>
    );
};
