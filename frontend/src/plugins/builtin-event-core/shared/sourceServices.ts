// input:  [schedule service, query client, query keys, and api service type references]
// output: [CalendarSourceServices interface for dependency-injected calendar source factories]
// pos:    [service injection contract used by built-in calendar source factory functions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type scheduleServiceType from '@/services/schedule';
import type { QueryClient } from '@tanstack/react-query';
import type { queryKeys as queryKeysType } from '@/services/queryKeys';
import type apiType from '@/services/api';

export interface CalendarSourceServices {
  scheduleService: typeof scheduleServiceType;
  queryClient: QueryClient;
  queryKeys: typeof queryKeysType;
  api: typeof apiType;
}
