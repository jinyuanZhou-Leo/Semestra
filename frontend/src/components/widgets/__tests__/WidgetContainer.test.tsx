import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WidgetContainer } from '../WidgetContainer';

type MatchMediaListener = (event: MediaQueryListEvent) => void;

const setupMatchMedia = (matches = false) => {
    const listeners = new Set<MatchMediaListener>();
    const mql = {
        matches,
        media: '(hover: none), (pointer: coarse)',
        onchange: null,
        addEventListener: (_event: string, cb: MatchMediaListener) => {
            listeners.add(cb);
        },
        removeEventListener: (_event: string, cb: MatchMediaListener) => {
            listeners.delete(cb);
        },
        addListener: (cb: MatchMediaListener) => {
            listeners.add(cb);
        },
        removeListener: (cb: MatchMediaListener) => {
            listeners.delete(cb);
        }
    };

    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => mql)
    });

    return mql;
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('WidgetContainer', () => {
    it('adds a single pointerdown listener for multiple widgets on touch devices', () => {
        setupMatchMedia(true);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

        const addSpy = vi.spyOn(document, 'addEventListener');
        const removeSpy = vi.spyOn(document, 'removeEventListener');

        const { unmount } = render(
            <>
                <WidgetContainer id="widget-1">
                    <div>Widget 1</div>
                </WidgetContainer>
                <WidgetContainer id="widget-2">
                    <div>Widget 2</div>
                </WidgetContainer>
            </>
        );

        const pointerAdds = addSpy.mock.calls.filter(call => call[0] === 'pointerdown').length;
        expect(pointerAdds).toBe(1);

        unmount();

        const pointerRemoves = removeSpy.mock.calls.filter(call => call[0] === 'pointerdown').length;
        expect(pointerRemoves).toBe(1);
    });

    it('keeps header empty area click-through while controls remain interactive', () => {
        setupMatchMedia(false);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

        const { container } = render(
            <WidgetContainer id="widget-1" onEdit={() => { }}>
                <div>Widget Content</div>
            </WidgetContainer>
        );

        const overlay = container.querySelector('[data-widget-header-overlay]') as HTMLDivElement | null;
        expect(overlay).toBeTruthy();
        expect(overlay).toHaveClass('pointer-events-none');

        const card = overlay?.parentElement as HTMLDivElement | null;
        const actions = overlay?.querySelector('.nodrag') as HTMLDivElement | null;
        expect(actions).toBeTruthy();
        expect(actions).toHaveClass('pointer-events-none');

        if (!card || !actions) {
            throw new Error('Missing widget header elements for interaction test');
        }

        fireEvent.mouseEnter(card);
        expect(overlay).toHaveClass('pointer-events-none');
        expect(actions).toHaveClass('pointer-events-auto');
    });
});
