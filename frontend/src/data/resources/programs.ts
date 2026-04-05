// input:  [TanStack Query primitives, Program APIs, app-side Program query keys, and QueryClient helpers]
// output: [Program query option builders, hooks, and cache invalidation helpers for app-side Program resources]
// pos:    [App-side Program data resource module centralizing list/detail/catalog/draft/tab-settings/LMS query wiring and cache orchestration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { queryOptions, useQueries, useQuery, type QueryClient } from '@tanstack/react-query';

import api, { type Program, type TabSetting } from '@/services/api';

import { courseKeys, programKeys, semesterKeys } from '../keys';

const PROGRAM_DETAIL_STALE_TIME_MS = 300_000;
const PROGRAM_PLUGIN_STALE_TIME_MS = 30_000;
const PROGRAM_DRAFT_STALE_TIME_MS = 15_000;

export const getProgramsListQueryOptions = () => queryOptions({
  queryKey: programKeys.list(),
  queryFn: api.getPrograms,
});

export const getProgramDetailQueryOptions = (programId: string) => queryOptions({
  queryKey: programKeys.detail(programId),
  queryFn: () => api.getProgram(programId),
  staleTime: PROGRAM_DETAIL_STALE_TIME_MS,
});

export const getProgramTabSettingsQueryOptions = (programId: string) => queryOptions({
  queryKey: programKeys.tabSettings(programId),
  queryFn: () => api.getProgramTabSettings(programId),
  staleTime: Infinity,
});

export const setProgramTabSettingsQueryData = (
  queryClient: QueryClient,
  programId: string,
  updater:
    | TabSetting[]
    | null
    | undefined
    | ((current: TabSetting[] | null | undefined) => TabSetting[] | null | undefined),
) => {
  queryClient.setQueryData<TabSetting[] | null | undefined>(programKeys.tabSettings(programId), updater);
};

export const getProgramPluginCatalogQueryOptions = (programId: string) => queryOptions({
  queryKey: programKeys.pluginCatalog(programId),
  queryFn: () => api.getProgramPluginCatalog(programId),
  staleTime: PROGRAM_PLUGIN_STALE_TIME_MS,
});

export const getProgramPluginInstallationsQueryOptions = (programId: string) => queryOptions({
  queryKey: programKeys.pluginInstallations(programId),
  queryFn: () => api.getProgramPluginInstallations(programId),
  staleTime: PROGRAM_PLUGIN_STALE_TIME_MS,
});

export const getProgramSemesterDraftQueryOptions = (programId: string) => queryOptions({
  queryKey: programKeys.semesterDraft(programId),
  queryFn: () => api.getCurrentSemesterDraft(programId),
  staleTime: PROGRAM_DRAFT_STALE_TIME_MS,
});

export const getProgramLmsCoursesQueryOptions = (
  programId: string,
  params?: Parameters<typeof api.listProgramLmsCourses>[1],
) => {
  const normalizedParams = (params ?? {}) as Record<string, unknown>;

  return queryOptions({
    queryKey: programKeys.lmsCourses(programId, normalizedParams),
    queryFn: () => api.listProgramLmsCourses(programId, params),
  });
};

export const useProgramsListQuery = () => {
  return useQuery(getProgramsListQueryOptions());
};

export const useProgramDetailQuery = (programId?: string) => {
  return useQuery({
    ...getProgramDetailQueryOptions(programId ?? 'disabled'),
    enabled: Boolean(programId),
  });
};

export const useProgramDetailQueries = (programIds: string[]) => {
  return useQueries({
    queries: programIds.map((programId) => getProgramDetailQueryOptions(programId)),
  });
};

export const useProgramPluginCatalogQuery = (programId?: string) => {
  return useQuery({
    ...getProgramPluginCatalogQueryOptions(programId ?? 'disabled'),
    enabled: Boolean(programId),
  });
};

export const useProgramPluginInstallationsQuery = (programId?: string) => {
  return useQuery({
    ...getProgramPluginInstallationsQueryOptions(programId ?? 'disabled'),
    enabled: Boolean(programId),
  });
};

export const useProgramSemesterDraftQuery = (programId?: string) => {
  return useQuery({
    ...getProgramSemesterDraftQueryOptions(programId ?? 'disabled'),
    enabled: Boolean(programId),
  });
};

export const invalidateProgramsListQuery = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: programKeys.list() });
};

export const invalidateProgramDetailQuery = async (queryClient: QueryClient, programId: string) => {
  await queryClient.invalidateQueries({ queryKey: programKeys.detail(programId) });
};

export const removeProgramDetailQuery = (queryClient: QueryClient, programId: string) => {
  queryClient.removeQueries({ queryKey: programKeys.detail(programId) });
};

export const setProgramDetailQueryData = (
  queryClient: QueryClient,
  programId: string,
  updater:
    | Program
    | null
    | undefined
    | ((current: Program | null | undefined) => Program | null | undefined),
) => {
  queryClient.setQueryData<Program | null | undefined>(programKeys.detail(programId), updater);
};

export const invalidateProgramPluginGovernanceQueries = async (
  queryClient: QueryClient,
  programId: string,
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: programKeys.pluginCatalog(programId) }),
    queryClient.invalidateQueries({ queryKey: programKeys.pluginInstallations(programId) }),
    queryClient.invalidateQueries({ queryKey: programKeys.detail(programId) }),
    queryClient.invalidateQueries({ queryKey: programKeys.semesterDraft(programId) }),
    queryClient.invalidateQueries({ queryKey: semesterKeys.all }),
    queryClient.invalidateQueries({ queryKey: courseKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['plugin-system', 'semesters'] }),
  ]);
};
