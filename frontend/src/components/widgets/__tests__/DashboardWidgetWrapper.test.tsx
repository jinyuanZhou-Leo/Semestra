// input:  [DashboardWidgetWrapper, mocked plugin-system facade state, and testing-library render assertions/interactions]
// output: [regression tests for widget loading skeletons, unavailable-widget delete fallback, and loaded-state fade-in rendering]
// pos:    [Widget wrapper tests that prevent known plugin types from flashing error UI before runtime registration completes and preserve unavailable-widget removal]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardWidgetWrapper } from '../DashboardWidgetWrapper';
import type { WidgetItem } from '../DashboardGrid';
import * as pluginSystem from '../../../plugin-system';

const createWidget = (overrides: Partial<WidgetItem>): WidgetItem => ({
    id: 'widget-1',
    type: 'lazy-widget',
    title: 'Lazy Widget',
    settings: {},
    ...overrides,
});

describe('DashboardWidgetWrapper', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(pluginSystem, 'useWidgetRenderState').mockReturnValue({
            status: 'loading',
            definition: undefined,
            loadError: null,
        });

        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: query === '(pointer: coarse)' ? false : false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    it('shows a ring-matched widget skeleton while a known widget plugin is still loading', async () => {
        render(
            <DashboardWidgetWrapper
                widget={createWidget({ id: 'widget-1', type: 'lazy-widget' })}
                onUpdateWidget={vi.fn().mockResolvedValue(undefined)}
            />
        );

        const skeleton = screen.getByTestId('plugin-widget-skeleton');
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('bg-card', 'ring-1', 'ring-foreground/10', 'shadow-none');
        expect(screen.queryByText('Widget Unavailable')).not.toBeInTheDocument();

        await waitFor(() => expect(screen.queryByText('Widget Unavailable')).not.toBeInTheDocument());
    });

    it('wraps loaded widget content in the fade-in transition shell', () => {
        vi.spyOn(pluginSystem, 'useWidgetRenderState').mockReturnValue({
            status: 'ready',
            definition: {
                type: 'loaded-widget',
                component: () => <div data-testid="loaded-widget">Loaded widget</div>,
            },
            loadError: null,
        });

        const { container } = render(
            <DashboardWidgetWrapper
                widget={createWidget({ id: 'widget-2', type: 'loaded-widget' })}
                onUpdateWidget={vi.fn().mockResolvedValue(undefined)}
            />
        );

        expect(screen.getByTestId('loaded-widget')).toBeInTheDocument();
        expect(container.querySelector('.motion-safe\\:transition-opacity')).not.toBeNull();
    });

    it('keeps delete available for unavailable widgets even when the normal widget remove action is disabled', () => {
        vi.spyOn(pluginSystem, 'useWidgetRenderState').mockReturnValue({
            status: 'error',
            definition: undefined,
            loadError: new Error('boom'),
        });

        const onRemoveUnavailable = vi.fn();

        render(
            <DashboardWidgetWrapper
                widget={createWidget({
                    id: 'widget-3',
                    type: 'missing-widget',
                    title: 'Missing Widget',
                    is_removable: false,
                })}
                onRemoveUnavailable={onRemoveUnavailable}
                onUpdateWidget={vi.fn().mockResolvedValue(undefined)}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Delete Widget' }));

        expect(onRemoveUnavailable).toHaveBeenCalledWith('widget-3');
    });

    it('re-renders when the widget runtime registers after mount', async () => {
        let isReady = false;
        vi.spyOn(pluginSystem, 'useWidgetRenderState').mockImplementation(() => (
            isReady
                ? {
                    status: 'ready',
                    definition: {
                        type: 'runtime-widget',
                        component: () => <div data-testid="runtime-widget">Runtime widget</div>,
                    },
                    loadError: null,
                }
                : {
                    status: 'loading',
                    definition: undefined,
                    loadError: null,
                }
        ));

        const { rerender } = render(
            <DashboardWidgetWrapper
                widget={createWidget({ id: 'widget-4', type: 'runtime-widget' })}
                onUpdateWidget={vi.fn().mockResolvedValue(undefined)}
                isEditMode={false}
            />
        );

        expect(screen.getByTestId('plugin-widget-skeleton')).toBeInTheDocument();

        isReady = true;
        rerender(
            <DashboardWidgetWrapper
                widget={createWidget({ id: 'widget-4', type: 'runtime-widget' })}
                onUpdateWidget={vi.fn().mockResolvedValue(undefined)}
                isEditMode
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('runtime-widget')).toBeInTheDocument();
        });
    });
});
