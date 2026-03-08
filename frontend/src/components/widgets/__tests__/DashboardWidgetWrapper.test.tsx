// input:  [DashboardWidgetWrapper, mocked plugin-system facade state, and testing-library render assertions]
// output: [regression tests for widget loading skeletons and loaded-state fade-in rendering]
// pos:    [Widget wrapper tests that prevent known plugin types from flashing error UI before runtime registration completes]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardWidgetWrapper } from '../DashboardWidgetWrapper';
import * as pluginSystem from '../../../plugin-system';

describe('DashboardWidgetWrapper', () => {
    beforeEach(() => {
        vi.restoreAllMocks();

        vi.spyOn(pluginSystem, 'ensureWidgetPluginByTypeLoaded').mockResolvedValue(true);
        vi.spyOn(pluginSystem, 'getWidgetDefinitionByType').mockReturnValue(undefined);
        vi.spyOn(pluginSystem, 'hasWidgetPluginForType').mockReturnValue(true);
        vi.spyOn(pluginSystem, 'useWidgetPluginLoadState').mockReturnValue({ status: 'idle', error: null });

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
        vi.spyOn(pluginSystem, 'getWidgetComponentByType').mockReturnValue(undefined);

        render(
            <DashboardWidgetWrapper
                widget={{ id: 'widget-1', type: 'lazy-widget', settings: {} } as any}
                onUpdateWidget={vi.fn().mockResolvedValue(undefined)}
            />
        );

        const skeleton = screen.getByTestId('plugin-widget-skeleton');
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('bg-card', 'ring-1', 'ring-foreground/10', 'shadow-none');
        expect(screen.queryByText('Widget Unavailable')).not.toBeInTheDocument();

        await waitFor(() => {
            expect(pluginSystem.ensureWidgetPluginByTypeLoaded).toHaveBeenCalledWith('lazy-widget');
        });
    });

    it('wraps loaded widget content in the fade-in transition shell', () => {
        vi.spyOn(pluginSystem, 'useWidgetPluginLoadState').mockReturnValue({ status: 'loaded', error: null });
        vi.spyOn(pluginSystem, 'getWidgetComponentByType').mockReturnValue(() => <div data-testid="loaded-widget">Loaded widget</div>);

        const { container } = render(
            <DashboardWidgetWrapper
                widget={{ id: 'widget-2', type: 'loaded-widget', settings: {} } as any}
                onUpdateWidget={vi.fn().mockResolvedValue(undefined)}
            />
        );

        expect(screen.getByTestId('loaded-widget')).toBeInTheDocument();
        expect(container.querySelector('.motion-safe\\:animate-in')).not.toBeNull();
    });
});
