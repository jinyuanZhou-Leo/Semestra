// input:  [WidgetContainer component, mocked pointer-capability media query, listener spies]
// output: [test suite validating widget control visibility and pointer-listener behavior]
// pos:    [Interaction regression tests for widget shell touch/hover behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
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

    it('keeps corner docks click-through while controls remain interactive', () => {
        setupMatchMedia(false);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

        const { container } = render(
            <WidgetContainer id="widget-1" onEdit={() => { }} isEditMode>
                <div>Widget Content</div>
            </WidgetContainer>
        );

        const leftDock = container.querySelector('[data-widget-corner-left]') as HTMLDivElement | null;
        const rightDock = container.querySelector('[data-widget-corner-right]') as HTMLDivElement | null;
        expect(leftDock).toBeTruthy();
        expect(leftDock).toHaveClass('pointer-events-none');
        expect(rightDock).toBeTruthy();
        expect(rightDock).toHaveClass('pointer-events-none');

        const card = container.firstElementChild as HTMLDivElement | null;
        if (!card) {
            throw new Error('Missing widget root for interaction test');
        }

        fireEvent.mouseEnter(card);
        expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });

    it('allows drag handle mousedown to bubble for grid drag start', () => {
        setupMatchMedia(false);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

        const documentMouseDownSpy = vi.fn();
        document.addEventListener('mousedown', documentMouseDownSpy);

        const { container } = render(
            <WidgetContainer id="widget-1" isEditMode>
                <div>Widget Content</div>
            </WidgetContainer>
        );

        const card = container.firstElementChild as HTMLDivElement | null;
        if (!card) {
            document.removeEventListener('mousedown', documentMouseDownSpy);
            throw new Error('Missing widget card root');
        }

        fireEvent.mouseEnter(card);
        const dragHandle = container.querySelector('.drag-handle') as HTMLDivElement | null;
        if (!dragHandle) {
            document.removeEventListener('mousedown', documentMouseDownSpy);
            throw new Error('Missing drag handle');
        }

        fireEvent.mouseDown(dragHandle);
        expect(documentMouseDownSpy).toHaveBeenCalled();
        document.removeEventListener('mousedown', documentMouseDownSpy);
    });

    it('does not render header controls when edit mode is disabled', () => {
        setupMatchMedia(false);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

        const { container } = render(
            <WidgetContainer
                id="widget-locked"
                isEditMode={false}
                onEdit={() => { }}
                onRemove={() => { }}
                headerButtons={<button type="button">Plugin Action</button>}
            >
                <div>Widget Content</div>
            </WidgetContainer>
        );

        const leftDock = container.querySelector('[data-widget-corner-left]');
        const rightDock = container.querySelector('[data-widget-corner-right]');
        const dragHandle = container.querySelector('.drag-handle');
        expect(leftDock).toBeNull();
        expect(rightDock).toBeNull();
        expect(dragHandle).toBeNull();
        expect(screen.queryByTitle('Settings')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Remove Widget')).not.toBeInTheDocument();
        expect(screen.queryByText('Plugin Action')).not.toBeInTheDocument();
    });
});
