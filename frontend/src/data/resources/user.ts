// input:  [TanStack Query primitives, auth/settings APIs, app-side user query keys, and QueryClient helpers]
// output: [User query option builders, hooks, and LMS integration invalidation helpers for app-side user resources]
// pos:    [App-side user data resource module centralizing current-user and LMS integration cache orchestration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';

import api from '@/services/api';

import { userKeys } from '../keys';

export const getUserLmsIntegrationsQueryOptions = () => queryOptions({
  queryKey: userKeys.lmsIntegrations(),
  queryFn: api.listLmsIntegrations,
});

export const useUserLmsIntegrationsQuery = () => {
  return useQuery(getUserLmsIntegrationsQueryOptions());
};

export const invalidateUserLmsIntegrationsQuery = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: userKeys.lmsIntegrations() });
};

export const invalidateUserLmsIntegrationQueries = async (
  queryClient: QueryClient,
  integrationId?: string,
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: userKeys.lmsIntegrations() }),
    ...(integrationId ? [queryClient.invalidateQueries({ queryKey: userKeys.lmsIntegration(integrationId) })] : []),
  ]);
};
