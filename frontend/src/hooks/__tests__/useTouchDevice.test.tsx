import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useTouchDevice } from '../useTouchDevice';

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
        },
        dispatch: () => {
            listeners.forEach(cb => cb({ matches: mql.matches } as MediaQueryListEvent));
        }
    };

    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => mql)
    });

    return mql;
};

const TouchDeviceProbe = () => {
    const isTouchDevice = useTouchDevice();
    return <div data-testid="touch-value">{String(isTouchDevice)}</div>;
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useTouchDevice', () => {
    it('returns false when matchMedia does not match', () => {
        setupMatchMedia(false);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

        render(<TouchDeviceProbe />);
        expect(screen.getByTestId('touch-value')).toHaveTextContent('false');
    });

    it('returns true when matchMedia matches', () => {
        setupMatchMedia(true);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

        render(<TouchDeviceProbe />);
        expect(screen.getByTestId('touch-value')).toHaveTextContent('true');
    });

    it('updates when the media query match changes', () => {
        const mql = setupMatchMedia(false);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

        render(<TouchDeviceProbe />);
        expect(screen.getByTestId('touch-value')).toHaveTextContent('false');

        mql.matches = true;
        mql.dispatch();

        expect(screen.getByTestId('touch-value')).toHaveTextContent('true');
    });
});
