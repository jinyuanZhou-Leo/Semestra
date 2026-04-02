// input:  [axios mock responses, normalized runtime API helpers, and Vitest assertions]
// output: [test suite covering runtime payload normalization for semester detail and runtime-tab write endpoints]
// pos:    [unit tests for the API layer's responsibility to collapse mixed backend runtime wire shapes into the single frontend runtime contract]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import axios from 'axios';

import api from './api';

type AxiosMock = {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockedAxios = axios as unknown as AxiosMock;

describe('api runtime normalization', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.put.mockReset();
  });

  it('normalizes semester runtime payloads into a single frontend shape', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        id: 'semester-1',
        name: 'Fall',
        average_scaled: 0,
        average_percentage: 0,
        resolved_tabs: [
          {
            id: 'tab-1',
            tab_type: 'world-clock',
            title: 'World Clock',
            resolved_settings: '{"timezone":"UTC"}',
            order_index: 3,
            plugin_id: 'world-clock',
            availability: { state: 'available' },
          },
        ],
        runtime_plugins: [
          {
            id: 'world-clock',
            available_widget_types: ['world-clock'],
          },
        ],
        tab_catalog_items: [],
        widget_catalog_items: [],
      },
    });

    const semester = await api.getSemester('semester-1');

    expect(semester.runtime.runtime_tabs).toEqual([
      {
        id: 'tab-1',
        type: 'world-clock',
        title: 'World Clock',
        settings: { timezone: 'UTC' },
        scope_settings: {},
        inherited_settings: {},
        settings_meta: {
          scopeSettings: {},
          inheritedSettings: {},
          settingSources: {},
        },
        order_index: 3,
        is_draggable: undefined,
        is_removable: undefined,
        plugin_id: 'world-clock',
        availability: { state: 'available' },
      },
    ]);
    expect(semester.runtime.enabled_plugins).toEqual([
      {
        plugin_id: 'world-clock',
        available_tab_types: [],
        available_widget_types: ['world-clock'],
      },
    ]);
  });

  it('normalizes runtime-tab update responses before returning them', async () => {
    mockedAxios.put.mockResolvedValue({
      data: {
        id: 'tab-2',
        tab_type: 'builtin-gradebook',
        title: 'Gradebook',
        resolved_settings: '{"display":"compact"}',
        order_index: 1,
        plugin_id: 'builtin-gradebook',
      },
    });

    const result = await api.updateSemesterRuntimeTabSettings('semester-1', 'builtin-gradebook', {
      settings: '{"display":"compact"}',
    });

    expect(result).toEqual({
      id: 'tab-2',
      type: 'builtin-gradebook',
      title: 'Gradebook',
      settings: { display: 'compact' },
      scope_settings: {},
      inherited_settings: {},
      settings_meta: {
        scopeSettings: {},
        inheritedSettings: {},
        settingSources: {},
      },
      order_index: 1,
      is_draggable: undefined,
      is_removable: undefined,
      plugin_id: 'builtin-gradebook',
      availability: { state: 'available' },
    });
  });
});
