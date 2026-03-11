// input:  [Tabs component, Testing Library render helpers, DOM layout mocks, wheel events, and Vitest matchers]
// output: [regression tests for workspace-tab alignment, overflow cues, wheel-driven horizontal scrolling, and tab actions]
// pos:    [component-level regression coverage for shared dashboard tab shell behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from '../Tabs';

class ResizeObserverMock {
    observe() {}
    disconnect() {}
    unobserve() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverMock,
    writable: true,
});

describe('Tabs component', () => {
    it('keeps the outer shell right-aligned while preserving full-width overflow support', () => {
        const { container } = render(
            <Tabs
                items={[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'calendar', label: 'Calendar' },
                ]}
                activeId="dashboard"
                onSelect={() => {}}
            />
        );

        const shell = container.firstElementChild;
        const tablist = screen.getByRole('tablist', { name: 'Dashboard Tabs' });

        expect(shell).toHaveClass('w-full');
        expect(shell).toHaveClass('justify-end');
        expect(tablist).toHaveClass('overflow-x-auto');
    });

    it('invokes select and add handlers from the rendered controls', () => {
        const handleSelect = vi.fn();
        const handleAdd = vi.fn();

        render(
            <Tabs
                items={[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'settings', label: 'Settings' },
                ]}
                activeId="dashboard"
                onSelect={handleSelect}
                onAdd={handleAdd}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
        fireEvent.click(screen.getByRole('button'));

        expect(handleSelect).toHaveBeenCalledWith('settings');
        expect(handleAdd).toHaveBeenCalledTimes(1);
    });

    it('shows edge shadows only while horizontal overflow remains off-screen', () => {
        const { container } = render(
            <Tabs
                items={[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'calendar', label: 'Calendar' },
                    { id: 'tasks', label: 'Tasks' },
                ]}
                activeId="dashboard"
                onSelect={() => {}}
                onAdd={() => {}}
            />
        );

        const tablist = screen.getByRole('tablist', { name: 'Dashboard Tabs' });
        Object.defineProperty(tablist, 'clientWidth', { configurable: true, value: 120 });
        Object.defineProperty(tablist, 'scrollWidth', { configurable: true, value: 360 });
        Object.defineProperty(tablist, 'scrollLeft', { configurable: true, writable: true, value: 0 });

        fireEvent.scroll(tablist);

        const shadows = container.querySelectorAll('[aria-hidden="true"]');
        const leftShadow = shadows[0];
        const rightShadow = shadows[1];

        expect(leftShadow).toHaveClass('opacity-0');
        expect(rightShadow).toHaveClass('opacity-100');

        Object.defineProperty(tablist, 'scrollLeft', { configurable: true, writable: true, value: 120 });
        fireEvent.scroll(tablist);

        expect(leftShadow).toHaveClass('opacity-100');
        expect(rightShadow).toHaveClass('opacity-100');

        Object.defineProperty(tablist, 'scrollLeft', { configurable: true, writable: true, value: 240 });
        fireEvent.scroll(tablist);

        expect(leftShadow).toHaveClass('opacity-100');
        expect(rightShadow).toHaveClass('opacity-0');
    });

    it('maps vertical wheel movement to horizontal tablist scrolling when tabs overflow', () => {
        render(
            <Tabs
                items={[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'calendar', label: 'Calendar' },
                    { id: 'tasks', label: 'Tasks' },
                ]}
                activeId="calendar"
                onSelect={() => {}}
            />
        );

        const tablist = screen.getByRole('tablist', { name: 'Dashboard Tabs' });
        Object.defineProperty(tablist, 'clientWidth', { configurable: true, value: 120 });
        Object.defineProperty(tablist, 'scrollWidth', { configurable: true, value: 360 });
        Object.defineProperty(tablist, 'scrollLeft', { configurable: true, writable: true, value: 40 });

        fireEvent.wheel(tablist, { deltaY: 60 });
        expect(tablist.scrollLeft).toBe(100);

        fireEvent.wheel(tablist, { deltaY: -30 });
        expect(tablist.scrollLeft).toBe(70);
    });

    it('prevents page scrolling for vertical wheel input while the tablist is horizontally scrollable', () => {
        render(
            <Tabs
                items={[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'calendar', label: 'Calendar' },
                    { id: 'tasks', label: 'Tasks' },
                ]}
                activeId="calendar"
                onSelect={() => {}}
            />
        );

        const tablist = screen.getByRole('tablist', { name: 'Dashboard Tabs' });
        Object.defineProperty(tablist, 'clientWidth', { configurable: true, value: 120 });
        Object.defineProperty(tablist, 'scrollWidth', { configurable: true, value: 360 });
        Object.defineProperty(tablist, 'scrollLeft', { configurable: true, writable: true, value: 240 });

        const wheelEvent = new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true });
        tablist.dispatchEvent(wheelEvent);

        expect(wheelEvent.defaultPrevented).toBe(true);
    });
});
