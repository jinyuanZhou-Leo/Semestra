// input:  [Tabs component, Testing Library render helpers, and Vitest matchers]
// output: [regression tests for workspace-tab alignment and tab actions]
// pos:    [component-level regression coverage for shared dashboard tab shell behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from '../Tabs';

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
});
