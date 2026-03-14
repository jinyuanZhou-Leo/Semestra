// input:  [TanStack Query client types and browser runtime provider consumers]
// output: [`queryClient` singleton and default Query cache behavior for app-wide server-state management]
// pos:    [Shared frontend query infrastructure that centralizes cache, stale-time, refetch, and mutation defaults]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { QueryClient } from '@tanstack/react-query';

export const DEFAULT_QUERY_STALE_TIME_MS = 60_000;
export const DEFAULT_QUERY_GC_TIME_MS = 10 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_QUERY_STALE_TIME_MS,
      gcTime: DEFAULT_QUERY_GC_TIME_MS,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
