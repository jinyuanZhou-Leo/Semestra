// input:  [React children and TanStack Query provider primitives]
// output: [`createQueryClientWrapper()` test helper for hook/component rendering with isolated query cache]
// pos:    [Frontend test helper that supplies a fresh QueryClient per render tree]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const createQueryClientWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return {
    queryClient,
    Wrapper,
  };
};
