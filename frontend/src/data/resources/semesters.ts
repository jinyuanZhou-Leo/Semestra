// input:  [TanStack Query primitives, Semester APIs, app-side Program/Semester query keys, and QueryClient helpers]
// output: [Semester query option builders, hooks, and draft-workflow cache helpers for app-side Semester resources]
// pos:    [App-side Semester data resource module centralizing detail/setup/todo-related cache wiring and draft invalidation rules]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';

import api, { type Semester, type TabSetting } from '@/services/api';

import { programKeys, semesterKeys } from '../keys';

const SEMESTER_DETAIL_STALE_TIME_MS = 300_000;
const SEMESTER_DRAFT_WORKFLOW_STALE_TIME_MS = 10_000;

export const getSemesterDetailQueryOptions = (semesterId: string) => queryOptions({
  queryKey: semesterKeys.detail(semesterId),
  queryFn: () => api.getSemester(semesterId),
  staleTime: SEMESTER_DETAIL_STALE_TIME_MS,
});

export const getSemesterTabSettingsQueryOptions = (semesterId: string) => queryOptions({
  queryKey: semesterKeys.tabSettings(semesterId),
  queryFn: () => api.getSemesterTabSettings(semesterId),
  staleTime: Infinity,
});

export const setSemesterTabSettingsQueryData = (
  queryClient: QueryClient,
  semesterId: string,
  updater:
    | TabSetting[]
    | null
    | undefined
    | ((current: TabSetting[] | null | undefined) => TabSetting[] | null | undefined),
) => {
  queryClient.setQueryData<TabSetting[] | null | undefined>(semesterKeys.tabSettings(semesterId), updater);
};

export const getSemesterPluginSystemSetupQueryOptions = (semesterId: string) => queryOptions({
  queryKey: semesterKeys.pluginSystemSetup(semesterId),
  queryFn: () => api.getSemesterPluginSystemSetup(semesterId),
  staleTime: SEMESTER_DRAFT_WORKFLOW_STALE_TIME_MS,
});

export const useSemesterDetailQuery = (semesterId?: string) => {
  return useQuery({
    ...getSemesterDetailQueryOptions(semesterId ?? 'disabled'),
    enabled: Boolean(semesterId),
  });
};

export const useSemesterPluginSystemSetupQuery = (semesterId?: string) => {
  return useQuery({
    ...getSemesterPluginSystemSetupQueryOptions(semesterId ?? 'disabled'),
    enabled: Boolean(semesterId),
  });
};

export const setSemesterDetailQueryData = (
  queryClient: QueryClient,
  semesterId: string,
  updater:
    | Semester
    | null
    | undefined
    | ((current: Semester | null | undefined) => Semester | null | undefined),
) => {
  queryClient.setQueryData<Semester | null | undefined>(semesterKeys.detail(semesterId), updater);
};

export const hydrateSemesterDraftWorkflowCaches = (
  queryClient: QueryClient,
  {
    programId,
    draft,
  }: {
    programId: string;
    draft: Semester;
  },
) => {
  queryClient.setQueryData(programKeys.semesterDraft(programId), draft);
  queryClient.setQueryData(semesterKeys.detail(draft.id), draft);
  queryClient.setQueryData(semesterKeys.pluginActivations(draft.id), draft.plugin_activations ?? []);
};

export const invalidateSemesterDraftWorkflowQueries = async (
  queryClient: QueryClient,
  {
    programId,
    draftId,
    includeProgramDetail = false,
  }: {
    programId: string;
    draftId?: string;
    includeProgramDetail?: boolean;
  },
) => {
  await Promise.all([
    ...(includeProgramDetail ? [queryClient.invalidateQueries({ queryKey: programKeys.detail(programId) })] : []),
    queryClient.invalidateQueries({ queryKey: programKeys.semesterDraft(programId) }),
    ...(draftId ? [queryClient.invalidateQueries({ queryKey: semesterKeys.detail(draftId) })] : []),
    ...(draftId ? [queryClient.invalidateQueries({ queryKey: semesterKeys.pluginActivations(draftId) })] : []),
    ...(draftId ? [queryClient.invalidateQueries({ queryKey: semesterKeys.pluginSystemSetup(draftId) })] : []),
  ]);
};

export const removeSemesterDraftWorkflowQueries = (
  queryClient: QueryClient,
  draftId: string,
) => {
  queryClient.removeQueries({ queryKey: semesterKeys.pluginSystemSetup(draftId) });
  queryClient.removeQueries({ queryKey: semesterKeys.pluginActivations(draftId) });
};
