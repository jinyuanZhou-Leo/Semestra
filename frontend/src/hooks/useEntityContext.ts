// input:  [entity ID, typed fetch/update functions, debounce interval, `useDataFetch`]
// output: [`useEntityContext<T>()` hook with optimistic `updateData` and refresh APIs]
// pos:    [Reusable optimistic-sync engine behind course and semester data providers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useCallback, useRef, useEffect } from 'react';
import { useDataFetch } from './useDataFetch';
import { reportError } from '../services/appStatus';

interface UseEntityContextOptions<T> {
    entityId: string;
    fetchFn: (id: string) => Promise<T>;
    updateFn: (id: string, updates: Partial<T>) => Promise<Partial<T>>;
    debounceMs?: number;
}

interface UseEntityContextResult<T> {
    data: T | null;
    setData: React.Dispatch<React.SetStateAction<T | null>>;
    updateData: (updates: Partial<T>) => void;
    refresh: () => Promise<void>;
    isLoading: boolean;
}

/**
 * A generic hook for entity data contexts with optimistic updates and debounced sync.
 * 
 * Features:
 * - Optimistic UI updates (immediate local state change)
 * - Debounced backend sync (batches updates within debounce window)
 * - Auto-sync pending updates on unmount
 * - Error recovery (re-queues failed updates)
 * 
 * @param options.entityId - The ID of the entity to manage
 * @param options.fetchFn - Function to fetch entity data
 * @param options.updateFn - Function to update entity on backend
 * @param options.debounceMs - Debounce delay for backend sync (default: 1000ms)
 */
export function useEntityContext<T extends object>({
    entityId,
    fetchFn,
    updateFn,
    debounceMs = 1000
}: UseEntityContextOptions<T>): UseEntityContextResult<T> {
    const pendingUpdates = useRef<Partial<T>>({});
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncSeqRef = useRef(0);

    const fetchEntityFn = useCallback(() => fetchFn(entityId), [entityId, fetchFn]);

    const {
        data,
        setData,
        isLoading,
        silentRefresh
    } = useDataFetch<T>({
        fetchFn: fetchEntityFn,
        enabled: !!entityId
    });

    const syncToBackend = useCallback(async () => {
        if (!entityId || Object.keys(pendingUpdates.current).length === 0) return;

        const updates = { ...pendingUpdates.current };
        pendingUpdates.current = {};
        const syncSeq = ++syncSeqRef.current;

        try {
            const result = await updateFn(entityId, updates);
            // Apply server-authoritative data only if no newer updates are pending.
            if (syncSeq === syncSeqRef.current && Object.keys(pendingUpdates.current).length === 0) {
                setData(prev => {
                    if (!prev) return result as T;
                    return { ...prev, ...result };
                });
            }
        } catch (error) {
            console.error(`Failed to sync entity ${entityId} to backend`, error);
            // On error, merge updates back to pending for retry
            pendingUpdates.current = { ...updates, ...pendingUpdates.current };
            reportError('Failed to sync changes. Will retry.');
        }
    }, [entityId, updateFn, setData]);

    const updateData = useCallback((updates: Partial<T>) => {
        // Optimistic update: apply changes to local state immediately
        setData(prev => {
            if (!prev) return prev;
            return { ...prev, ...updates };
        });

        // Queue updates for backend sync
        pendingUpdates.current = { ...pendingUpdates.current, ...updates };

        // Debounce backend sync
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = setTimeout(syncToBackend, debounceMs);
    }, [syncToBackend, setData, debounceMs]);

    // Cleanup: ensure pending updates are synced before unmount
    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
            if (Object.keys(pendingUpdates.current).length > 0 && entityId) {
                updateFn(entityId, pendingUpdates.current)
                    .then((result) => {
                        setData(prev => {
                            if (!prev) return result as T;
                            return { ...prev, ...result };
                        });
                    })
                    .catch((error) => {
                        console.error(`Failed to flush entity ${entityId} updates`, error);
                        reportError('Failed to sync changes. Please retry.');
                    });
            }
        };
    }, [entityId, updateFn, setData]);

    return {
        data,
        setData,
        updateData,
        refresh: silentRefresh,
        isLoading
    };
}
