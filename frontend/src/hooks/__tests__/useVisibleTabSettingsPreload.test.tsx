// input:  [visible-tab settings preload hook, testing-library hook helpers, and Vitest assertions]
// output: [test suite validating settings-page preloading of visible tab runtimes]
// pos:    [hook-level regression tests for tab settings runtime preloading behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useVisibleTabSettingsPreload } from '../useVisibleTabSettingsPreload';

describe('useVisibleTabSettingsPreload', () => {
  it('preloads runtimes for visible tabs when settings are active', async () => {
    const { result } = renderHook(() => useVisibleTabSettingsPreload({
      tabs: [{ type: 'tab-template' }],
      enabled: true,
    }));

    await waitFor(() => {
      expect(result.current.has('tab-template')).toBe(true);
    });
  });
});
