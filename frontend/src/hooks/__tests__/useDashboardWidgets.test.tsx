// input:  [dashboard widget hook, mocked widget delete API, and testing-library hook helpers]
// output: [regression tests covering unavailable-widget force deletion]
// pos:    [Hook-level regression tests for dashboard widget delete orchestration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDashboardWidgets } from '../useDashboardWidgets';

const { apiMock } = vi.hoisted(() => ({
    apiMock: {
        deleteWidget: vi.fn(),
        updateWidget: vi.fn(),
    },
}));

vi.mock('@/services/api', () => ({
    default: apiMock,
}));

vi.mock('@/services/appStatus', () => ({
    clearSyncRetryAction: vi.fn(),
    registerSyncRetryAction: vi.fn(),
    reportError: vi.fn(),
}));

vi.mock('@/services/widgetRegistry', () => ({
    WidgetRegistry: {
        get: vi.fn(),
    },
}));

vi.mock('@/plugin-system', () => ({
    canAddWidgetCatalogItem: vi.fn(),
    ensureWidgetPluginByTypeLoaded: vi.fn(),
    getResolvedWidgetLayoutByType: vi.fn(),
    getResolvedWidgetMetadataByType: vi.fn(),
    getWidgetCatalogItemByType: vi.fn(),
}));

describe('useDashboardWidgets', () => {
    beforeEach(() => {
        apiMock.deleteWidget.mockReset();
        apiMock.updateWidget.mockReset();
    });

    it('routes unavailable-widget deletion through the force-enabled API path', async () => {
        apiMock.deleteWidget.mockResolvedValue(undefined);

        const { result } = renderHook(() => useDashboardWidgets({
            courseId: 'course-1',
            initialWidgets: [
                {
                    id: 'widget-1',
                    widget_type: 'missing-widget',
                    title: 'Missing Widget',
                    layout_config: '{}',
                    settings: '{}',
                    is_removable: false,
                },
            ],
        }));

        await waitFor(() => {
            expect(result.current.widgets).toHaveLength(1);
        });

        await act(async () => {
            await result.current.removeUnavailableWidget('widget-1');
        });

        expect(apiMock.deleteWidget).toHaveBeenCalledWith('widget-1', { force: true });
        expect(result.current.widgets).toHaveLength(0);
    });

    it('rolls back optimistic widget updates when the immediate save fails', async () => {
        apiMock.updateWidget.mockRejectedValue(new Error('save failed'));

        const { result } = renderHook(() => useDashboardWidgets({
            courseId: 'course-1',
            initialWidgets: [
                {
                    id: 'widget-1',
                    widget_type: 'counter',
                    title: 'Counter',
                    layout_config: '{}',
                    settings: '{"value":1}',
                    is_removable: true,
                },
            ],
        }));

        await waitFor(() => {
            expect(result.current.widgets[0]?.settings).toEqual({ value: 1 });
        });

        await act(async () => {
            await result.current.updateWidget('widget-1', {
                settings: JSON.stringify({ value: 2 }),
            });
        });

        expect(apiMock.updateWidget).toHaveBeenCalledWith('widget-1', {
            settings: JSON.stringify({ value: 2 }),
        });
        expect(result.current.widgets[0]?.settings).toEqual({ value: 1 });
    });
});
