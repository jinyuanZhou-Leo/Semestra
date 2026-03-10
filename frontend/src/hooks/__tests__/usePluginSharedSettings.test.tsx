// input:  [plugin shared settings hook, mocked plugin settings APIs, and testing-library hook helpers]
// output: [test suite validating framework-managed plugin-global settings loading and debounced sync]
// pos:    [hook-level regression tests for plugin shared settings persistence]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePluginSharedSettings } from '../usePluginSharedSettings';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getPluginSettingsForSemester: vi.fn(),
    getPluginSettingsForCourse: vi.fn(),
    upsertPluginSettingsForSemester: vi.fn(),
    upsertPluginSettingsForCourse: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('@/services/appStatus', () => ({
  reportError: vi.fn(),
}));

describe('usePluginSharedSettings', () => {
  beforeEach(() => {
    apiMock.getPluginSettingsForSemester.mockReset();
    apiMock.getPluginSettingsForCourse.mockReset();
    apiMock.upsertPluginSettingsForSemester.mockReset();
    apiMock.upsertPluginSettingsForCourse.mockReset();
  });

  it('loads existing settings and syncs updates through the framework autosave path', async () => {
    apiMock.getPluginSettingsForSemester.mockResolvedValue([
      {
        id: 'setting-1',
        plugin_id: 'course-list',
        settings: '{"sortBy":"name"}',
        semester_id: 'semester-1',
      },
    ]);
    apiMock.upsertPluginSettingsForSemester.mockImplementation(
      async (_semesterId: string, pluginId: string, data: { settings: string }) => ({
        id: 'setting-1',
        plugin_id: pluginId,
        settings: data.settings,
        semester_id: 'semester-1',
      })
    );

    const { result } = renderHook(() => usePluginSharedSettings({
      pluginId: 'course-list',
      semesterId: 'semester-1',
    }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.settings).toEqual({ sortBy: 'name' });

    act(() => {
      result.current.updateSettings({ sortBy: 'grade' });
    });

    await waitFor(() => {
      expect(apiMock.upsertPluginSettingsForSemester).toHaveBeenCalledWith(
        'semester-1',
        'course-list',
        { settings: '{"sortBy":"grade"}' }
      );
    });
  });

  it('keeps the shared-settings save debounced across rerenders', async () => {
    apiMock.getPluginSettingsForSemester.mockResolvedValue([
      {
        id: 'setting-1',
        plugin_id: 'course-list',
        settings: '{}',
        semester_id: 'semester-1',
      },
    ]);
    apiMock.upsertPluginSettingsForSemester.mockImplementation(
      async (_semesterId: string, pluginId: string, data: { settings: string }) => ({
        id: 'setting-1',
        plugin_id: pluginId,
        settings: data.settings,
        semester_id: 'semester-1',
      })
    );

    try {
      const { result, rerender } = renderHook(() => usePluginSharedSettings({
        pluginId: 'course-list',
        semesterId: 'semester-1',
      }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.useFakeTimers();

      act(() => {
        result.current.updateSettings({ sortBy: 'grade' });
      });

      rerender();

      expect(apiMock.upsertPluginSettingsForSemester).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(299);
      });

      expect(apiMock.upsertPluginSettingsForSemester).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(apiMock.upsertPluginSettingsForSemester).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
