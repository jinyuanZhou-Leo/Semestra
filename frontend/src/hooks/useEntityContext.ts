// input:  [entity ID, typed fetch/update functions, debounce interval, TanStack Query key/client utilities, and stale-context guards]
// output: [`useEntityContext<T>()` hook with query-cache-backed optimistic `updateData`, refresh APIs, and context-safe sync]
// pos:    [Reusable optimistic-sync engine behind course, semester, and program data providers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useCallback, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { reportError } from '../services/appStatus';

interface UseEntityContextOptions<T> {
    entityId: string;
    queryKey: QueryKey;
    fetchFn: (id: string) => Promise<T>;
    updateFn: (id: string, updates: Partial<T>) => Promise<Partial<T>>;
    debounceMs?: number;
    staleTimeMs?: number;
}

interface UseEntityContextResult<T> {
    data: T | null;
    setData: React.Dispatch<React.SetStateAction<T | null>>;
    updateData: (updates: Partial<T>) => void;
    commitData: (updates: Partial<T>) => Promise<void>;
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
    queryKey,
    fetchFn,
    updateFn,
    debounceMs = 1000,
    staleTimeMs
}: UseEntityContextOptions<T>): UseEntityContextResult<T> {
    const pendingUpdates = useRef<Partial<T>>({});
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncSeqRef = useRef(0);
    const entityIdRef = useRef(entityId);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery<T>({
        queryKey,
        queryFn: () => fetchFn(entityId),
        enabled: !!entityId,
        staleTime: staleTimeMs,
    });

    const setData = useCallback<React.Dispatch<React.SetStateAction<T | null>>>((updater) => {
        queryClient.setQueryData<T | null>(queryKey, (current) => {
            const baseValue = current ?? null;
            return typeof updater === 'function'
                ? (updater as (prevState: T | null) => T | null)(baseValue)
                : updater;
        });
    }, [queryClient, queryKey]);

    const mutation = useMutation({
        mutationFn: async ({ targetEntityId, updates }: { targetEntityId: string; updates: Partial<T> }) => (
            updateFn(targetEntityId, updates)
        ),
    });

    const syncToBackend = useCallback(async () => {
        const targetEntityId = entityIdRef.current;
        if (!targetEntityId || Object.keys(pendingUpdates.current).length === 0) return;

        const updates = { ...pendingUpdates.current };
        pendingUpdates.current = {};
        const syncSeq = ++syncSeqRef.current;

        try {
            const result = await mutation.mutateAsync({ targetEntityId, updates });
            if (entityIdRef.current !== targetEntityId) return;
            // Apply server-authoritative data only if no newer updates are pending.
            if (syncSeq === syncSeqRef.current && Object.keys(pendingUpdates.current).length === 0) {
                setData(prev => {
                    if (!prev) return result as T;
                    return { ...prev, ...result };
                });
            }
        } catch (error) {
            if (entityIdRef.current !== targetEntityId) return;
            console.error(`Failed to sync entity ${targetEntityId} to backend`, error);
            // On error, merge updates back to pending for retry
            pendingUpdates.current = { ...updates, ...pendingUpdates.current };
            reportError('Failed to sync changes. Will retry.');
        }
    }, [mutation, setData]);

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

    const commitData = useCallback(async (updates: Partial<T>) => {
        const targetEntityId = entityIdRef.current;
        if (!targetEntityId) return;

        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
        }
        pendingUpdates.current = {};
        syncSeqRef.current += 1;

        setData(prev => {
            if (!prev) return prev;
            return { ...prev, ...updates };
        });

        try {
            const result = await mutation.mutateAsync({ targetEntityId, updates });
            if (entityIdRef.current !== targetEntityId) return;

            setData(prev => {
                if (!prev) return result as T;
                return { ...prev, ...result };
            });
        } catch (error) {
            console.error(`Failed to commit entity ${targetEntityId} to backend`, error);
            reportError('Failed to sync changes. Please retry.');
            await queryClient.invalidateQueries({ queryKey });
            await queryClient.refetchQueries({ queryKey, type: 'active' });
            throw error;
        }
    }, [mutation, queryClient, queryKey, setData]);

    useEffect(() => {
        entityIdRef.current = entityId;
        pendingUpdates.current = {};
        syncSeqRef.current = 0;

        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
        }
    }, [entityId]);

    // Cleanup: ensure pending updates are synced before unmount
    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
            if (Object.keys(pendingUpdates.current).length > 0 && entityIdRef.current) {
                const targetEntityId = entityIdRef.current;
                const pending = { ...pendingUpdates.current };
                pendingUpdates.current = {};
                void mutation.mutateAsync({ targetEntityId, updates: pending })
                    .catch((error) => {
                        console.error(`Failed to flush entity ${targetEntityId} updates`, error);
                        reportError('Failed to sync changes. Please retry.');
                    });
            }
        };
    }, [mutation]);

    return {
        data: data ?? null,
        setData,
        updateData,
        commitData,
        refresh: async () => {
            if (!entityId) return;
            await queryClient.invalidateQueries({ queryKey });
            await queryClient.refetchQueries({ queryKey, type: 'active' });
        },
        isLoading
    };
}
