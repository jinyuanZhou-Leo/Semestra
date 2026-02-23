// input:  [typed async `fetchFn`, enable flag, global error reporter]
// output: [`useDataFetch<T>()` hook plus option/result interfaces]
// pos:    [Generic fetch primitive used as the base for page-level data contexts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useState, useCallback, useEffect } from 'react';
import { reportError } from '../services/appStatus';

interface UseDataFetchOptions<T> {
    fetchFn: () => Promise<T>;
    enabled?: boolean;
}

interface UseDataFetchResult<T> {
    data: T | null;
    setData: React.Dispatch<React.SetStateAction<T | null>>;
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    silentRefresh: () => Promise<void>;
}

/**
 * A generic hook for fetching data with support for silent refresh.
 * 
 * @param options.fetchFn - The async function to fetch data
 * @param options.enabled - Whether to enable initial fetch (default: true)
 * 
 * @returns data, setData, isLoading, error, refresh (shows loading), silentRefresh (no loading state)
 */
export function useDataFetch<T>({ fetchFn, enabled = true }: UseDataFetchOptions<T>): UseDataFetchResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async (silent = false) => {
        try {
            if (!silent) setIsLoading(true);
            setError(null);
            const result = await fetchFn();
            setData(result);
        } catch (err) {
            console.error("Failed to fetch data", err);
            setError(err instanceof Error ? err : new Error(String(err)));
            if (!silent) {
                reportError('Failed to load data. Please retry.');
            }
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [fetchFn]);

    useEffect(() => {
        if (enabled) {
            fetchData(false);
        }
    }, [enabled, fetchData]);

    const refresh = useCallback(() => fetchData(false), [fetchData]);
    const silentRefresh = useCallback(() => fetchData(true), [fetchData]);

    return {
        data,
        setData,
        isLoading,
        error,
        refresh,
        silentRefresh
    };
}
