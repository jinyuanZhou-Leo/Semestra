// input:  [plugin UI-state hook, runtime instance context provider, browser storage APIs, and Vitest utilities]
// output: [UI-state cache regression tests]
// pos:    [Regression coverage for plugin-local UI-state persistence, isolation, corruption handling, validation, and memory fallback]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    PluginRuntimeInstanceProvider,
    buildPluginUiStateStorageKey,
    resetPluginUiStateCacheForTests,
    usePluginUiState,
    type PluginRuntimeInstanceValue,
} from './index';

const buildWrapper = (value: PluginRuntimeInstanceValue) => {
    return ({ children }: { children: React.ReactNode }) => (
        <PluginRuntimeInstanceProvider value={value}>
            {children}
        </PluginRuntimeInstanceProvider>
    );
};

const createMockStorage = () => {
    const store = new Map<string, string>();

    return {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
            store.set(key, String(value));
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => {
            store.clear();
        },
    } as Storage;
};

const resetLocalStorage = () => {
    const storage = window.localStorage as Partial<Storage> | undefined;
    if (storage && typeof storage.clear === 'function') {
        storage.clear();
    }
};

describe('usePluginUiState', () => {
    const semesterWidgetScope: PluginRuntimeInstanceValue = {
        workspaceKind: 'semester',
        workspaceId: 'semester-1',
        slotKind: 'widget',
        slotId: 'widget-1',
    };
    const semesterWidgetScopeTwo: PluginRuntimeInstanceValue = {
        workspaceKind: 'semester',
        workspaceId: 'semester-1',
        slotKind: 'widget',
        slotId: 'widget-2',
    };

    beforeEach(() => {
        Object.defineProperty(window, 'localStorage', {
            value: createMockStorage(),
            configurable: true,
        });
        resetPluginUiStateCacheForTests();
        resetLocalStorage();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetPluginUiStateCacheForTests();
        resetLocalStorage();
    });

    it('persists, restores, and resets UI state', () => {
        const storageKey = buildPluginUiStateStorageKey(semesterWidgetScope, 'resource-dialog');
        const wrapper = buildWrapper(semesterWidgetScope);

        const { result, unmount } = renderHook(
            () => usePluginUiState<{ open: boolean; value: string }>('resource-dialog', () => ({ open: false, value: '' })),
            { wrapper }
        );

        expect(result.current.state).toEqual({ open: false, value: '' });

        act(() => {
            result.current.setState({ open: true, value: 'hello' });
        });

        expect(result.current.state).toEqual({ open: true, value: 'hello' });
        expect(window.localStorage.getItem(storageKey)).toBe(JSON.stringify({ open: true, value: 'hello' }));

        unmount();

        const remounted = renderHook(
            () => usePluginUiState<{ open: boolean; value: string }>('resource-dialog', () => ({ open: false, value: '' })),
            { wrapper }
        );

        expect(remounted.result.current.state).toEqual({ open: true, value: 'hello' });

        act(() => {
            remounted.result.current.resetState();
        });

        expect(remounted.result.current.state).toEqual({ open: false, value: '' });
        expect(window.localStorage.getItem(storageKey)).toBeNull();
    });

    it('keeps UI state isolated between slot instances', () => {
        const storageKeyOne = buildPluginUiStateStorageKey(semesterWidgetScope, 'shared-key');
        const storageKeyTwo = buildPluginUiStateStorageKey(semesterWidgetScopeTwo, 'shared-key');
        const wrapperOne = buildWrapper(semesterWidgetScope);
        const wrapperTwo = buildWrapper(semesterWidgetScopeTwo);

        const first = renderHook(
            () => usePluginUiState<{ enabled: boolean }>('shared-key', { enabled: false }),
            { wrapper: wrapperOne }
        );

        act(() => {
            first.result.current.setState({ enabled: true });
        });

        const second = renderHook(
            () => usePluginUiState<{ enabled: boolean }>('shared-key', { enabled: false }),
            { wrapper: wrapperTwo }
        );

        expect(first.result.current.state).toEqual({ enabled: true });
        expect(second.result.current.state).toEqual({ enabled: false });
        expect(window.localStorage.getItem(storageKeyOne)).toBe(JSON.stringify({ enabled: true }));
        expect(storageKeyOne).not.toBe(storageKeyTwo);
        expect(window.localStorage.getItem(storageKeyTwo)).toBeNull();
    });

    it('falls back to the initial state and removes corrupt cached JSON', () => {
        const storageKey = buildPluginUiStateStorageKey(semesterWidgetScope, 'broken-cache');
        window.localStorage.setItem(storageKey, '{broken-json');

        const { result } = renderHook(
            () => usePluginUiState('broken-cache', { count: 1 }),
            { wrapper: buildWrapper(semesterWidgetScope) }
        );

        expect(result.current.state).toEqual({ count: 1 });
        expect(window.localStorage.getItem(storageKey)).toBeNull();
    });

    it('keeps working when browser storage throws', () => {
        vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        const wrapper = buildWrapper(semesterWidgetScope);
        const { result, unmount } = renderHook(
            () => usePluginUiState<{ enabled: boolean }>('memory-only', { enabled: false }),
            { wrapper }
        );

        act(() => {
            result.current.setState({ enabled: true });
        });

        expect(result.current.state).toEqual({ enabled: true });

        unmount();

        const remounted = renderHook(
            () => usePluginUiState<{ enabled: boolean }>('memory-only', { enabled: false }),
            { wrapper }
        );

        expect(remounted.result.current.state).toEqual({ enabled: true });
    });

    it('treats initialState as a seed and reset baseline instead of a reactive input', () => {
        const wrapper = buildWrapper(semesterWidgetScope);
        const { result, rerender } = renderHook(
            ({ seed }) => usePluginUiState('seed-only', () => ({ value: seed })),
            {
                wrapper,
                initialProps: { seed: 'first' },
            }
        );

        expect(result.current.state).toEqual({ value: 'first' });

        rerender({ seed: 'second' });
        expect(result.current.state).toEqual({ value: 'first' });

        act(() => {
            result.current.resetState();
        });

        expect(result.current.state).toEqual({ value: 'second' });
    });

    it('keeps the previous state when the next state is not JSON-serializable plain data', () => {
        const storageKey = buildPluginUiStateStorageKey(semesterWidgetScope, 'invalid-next-state');
        const wrapper = buildWrapper(semesterWidgetScope);
        const { result } = renderHook(
            () => usePluginUiState<{ enabled: boolean }>('invalid-next-state', { enabled: false }),
            { wrapper }
        );

        act(() => {
            result.current.setState(new Map([['enabled', true]]) as unknown as { enabled: boolean });
        });

        expect(result.current.state).toEqual({ enabled: false });
        expect(window.localStorage.getItem(storageKey)).toBeNull();
    });
});
