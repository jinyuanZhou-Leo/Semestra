// input:  [plugin host provider, dialog provider, visible tabs, and tab-jump hook consumers]
// output: [regression tests for confirmed tab jumps, missing targets, and ambiguous type resolution]
// pos:    [Host-navigation contract tests guarding the public plugin jump API]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { type PropsWithChildren } from 'react';
import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DialogProvider } from '../contexts/DialogContext';

import { PluginHostProvider, usePluginHost, type PluginHostJumpResult, type PluginHostTabLike } from './PluginHostContext';

const buildWrapper = (visibleTabs: PluginHostTabLike[], setActiveTabId = vi.fn()) => {
    const wrapper: React.FC<PropsWithChildren> = ({ children }) => (
        <DialogProvider>
            <PluginHostProvider visibleTabs={visibleTabs} setActiveTabId={setActiveTabId}>
                {children}
            </PluginHostProvider>
        </DialogProvider>
    );

    return { wrapper, setActiveTabId };
};

describe('PluginHostContext', () => {
    it('confirms and jumps by tabId', async () => {
        const visibleTabs: PluginHostTabLike[] = [
            { id: 'dashboard-tab', type: 'dashboard', title: 'Dashboard' },
            { id: 'gradebook-tab', type: 'builtin-gradebook', title: 'Gradebook' },
        ];
        const { wrapper, setActiveTabId } = buildWrapper(visibleTabs);
        const { result } = renderHook(() => usePluginHost(), { wrapper });

        let jumpPromise: Promise<PluginHostJumpResult>;
        act(() => {
            jumpPromise = result.current.jumpToTab({ tabId: 'gradebook-tab' });
        });

        expect(screen.getByRole('dialog')).toHaveTextContent('Jump to tab?');
        fireEvent.click(screen.getByRole('button', { name: 'Open' }));

        await expect(jumpPromise!).resolves.toEqual({ status: 'jumped', tabId: 'gradebook-tab' });
        expect(setActiveTabId).toHaveBeenCalledWith('gradebook-tab');
    });

    it('allows canceling a confirmed jump', async () => {
        const visibleTabs: PluginHostTabLike[] = [
            { id: 'settings-tab', type: 'settings', title: 'Settings' },
        ];
        const { wrapper, setActiveTabId } = buildWrapper(visibleTabs);
        const { result } = renderHook(() => usePluginHost(), { wrapper });

        let jumpPromise: Promise<PluginHostJumpResult>;
        act(() => {
            jumpPromise = result.current.jumpToTab({ tabType: 'settings' });
        });

        expect(screen.getByRole('dialog')).toHaveTextContent('Jump to tab?');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        await expect(jumpPromise!).resolves.toEqual({ status: 'cancelled' });
        expect(setActiveTabId).not.toHaveBeenCalled();
    });

    it('reports a missing tabId target without jumping', async () => {
        const { wrapper, setActiveTabId } = buildWrapper([]);
        const { result } = renderHook(() => usePluginHost(), { wrapper });

        let jumpPromise: Promise<PluginHostJumpResult>;
        act(() => {
            jumpPromise = result.current.jumpToTab({ tabId: 'missing-tab' });
        });

        expect(screen.getByRole('dialog')).toHaveTextContent('Tab unavailable');
        fireEvent.click(screen.getByRole('button', { name: 'OK' }));

        await expect(jumpPromise!).resolves.toEqual({ status: 'missing' });
        expect(setActiveTabId).not.toHaveBeenCalled();
    });

    it('reports an ambiguous tabType target without jumping', async () => {
        const visibleTabs: PluginHostTabLike[] = [
            { id: 'gradebook-1', type: 'builtin-gradebook', title: 'Gradebook A' },
            { id: 'gradebook-2', type: 'builtin-gradebook', title: 'Gradebook B' },
        ];
        const { wrapper, setActiveTabId } = buildWrapper(visibleTabs);
        const { result } = renderHook(() => usePluginHost(), { wrapper });

        let jumpPromise: Promise<PluginHostJumpResult>;
        act(() => {
            jumpPromise = result.current.jumpToTab({ tabType: 'builtin-gradebook' });
        });

        expect(screen.getByRole('dialog')).toHaveTextContent('Multiple tabs match');
        fireEvent.click(screen.getByRole('button', { name: 'OK' }));

        await expect(jumpPromise!).resolves.toEqual({ status: 'ambiguous' });
        expect(setActiveTabId).not.toHaveBeenCalled();
    });

    it('confirms and jumps by tabType when the match is unique', async () => {
        const visibleTabs: PluginHostTabLike[] = [
            { id: 'schedule-tab', type: 'builtin-course-schedule', title: 'Course Schedule' },
        ];
        const { wrapper, setActiveTabId } = buildWrapper(visibleTabs);
        const { result } = renderHook(() => usePluginHost(), { wrapper });

        let jumpPromise: Promise<PluginHostJumpResult>;
        act(() => {
            jumpPromise = result.current.jumpToTab({ tabType: 'builtin-course-schedule' });
        });

        expect(screen.getByRole('dialog')).toHaveTextContent('Jump to tab?');
        fireEvent.click(screen.getByRole('button', { name: 'Open' }));

        await expect(jumpPromise!).resolves.toEqual({ status: 'jumped', tabId: 'schedule-tab' });
        expect(setActiveTabId).toHaveBeenCalledWith('schedule-tab');
    });
});
