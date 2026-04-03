// input:  [plugin runtime instance scope, browser storage APIs, and plugin UI-state consumers]
// output: [usePluginUiState hook plus UI-state cache helpers for transient plugin-local browser state]
// pos:    [Frontend-only UI-state cache layer for plugin-local transient state that survives remounts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useCallback, useEffect, useRef, useState } from 'react';

import {
    buildPluginUiStateStorageKey,
    usePluginRuntimeInstanceContext,
} from './PluginRuntimeInstanceContext';

export type PluginUiStatePrimitive = string | number | boolean | null;
export type PluginUiStateValue =
    | PluginUiStatePrimitive
    | PluginUiStateValue[]
    | { [key: string]: PluginUiStateValue };

export type PluginUiStateSerializable<T> =
    T extends PluginUiStatePrimitive
        ? T
        : T extends Array<infer Item>
            ? PluginUiStateSerializable<Item>[]
            : T extends object
                ? { [Key in keyof T]: PluginUiStateSerializable<T[Key]> }
                : never;

type UiStateUpdate<T> = T | ((currentState: T) => T);
type UiStateStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const memoryUiStateMap = new Map<string, string>();

const getStorage = (): UiStateStorage | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    const candidate = window.localStorage as Partial<Storage> | undefined;
    if (!candidate) {
        return null;
    }

    if (
        typeof candidate.getItem !== 'function' ||
        typeof candidate.setItem !== 'function' ||
        typeof candidate.removeItem !== 'function'
    ) {
        return null;
    }

    return {
        getItem: (key) => candidate.getItem!(key),
        setItem: (key, value) => candidate.setItem!(key, value),
        removeItem: (key) => candidate.removeItem!(key),
    };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (Object.prototype.toString.call(value) !== '[object Object]') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const isSerializableUiStateValue = (
    value: unknown,
    seenObjects: WeakSet<object> = new WeakSet()
): value is PluginUiStateValue => {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return true;
    }

    if (Array.isArray(value)) {
        if (seenObjects.has(value)) {
            return false;
        }

        seenObjects.add(value);
        return value.every((item) => isSerializableUiStateValue(item, seenObjects));
    }

    if (!isPlainObject(value)) {
        return false;
    }

    if (seenObjects.has(value)) {
        return false;
    }

    seenObjects.add(value);
    return Object.values(value).every((item) => isSerializableUiStateValue(item, seenObjects));
};

const resolveInitialState = <T,>(initialState: T | (() => T)): T => {
    return typeof initialState === 'function'
        ? (initialState as () => T)()
        : initialState;
};

const ensureValidUiStateValue = <T,>(
    value: T,
    storageKey: string,
    sourceLabel: 'initialState' | 'nextState'
): T | null => {
    if (isSerializableUiStateValue(value)) {
        return value;
    }

    const message = `usePluginUiState ${sourceLabel} for ${storageKey} must be JSON-serializable plain data`;
    if (sourceLabel === 'initialState') {
        throw new Error(message);
    }

    console.warn(message, value);
    return null;
};

const readRawUiState = (storageKey: string): string | null => {
    const storage = getStorage();
    if (storage) {
        try {
            const value = storage.getItem(storageKey);
            if (value !== null) {
                memoryUiStateMap.set(storageKey, value);
                return value;
            }
        } catch (error) {
            console.warn(`Failed to read plugin UI state for ${storageKey}`, error);
        }
    }

    return memoryUiStateMap.get(storageKey) ?? null;
};

const writeRawUiState = (storageKey: string, serializedValue: string) => {
    memoryUiStateMap.set(storageKey, serializedValue);

    const storage = getStorage();
    if (!storage) {
        return;
    }

    try {
        storage.setItem(storageKey, serializedValue);
    } catch (error) {
        console.warn(`Failed to persist plugin UI state for ${storageKey}`, error);
    }
};

const removeRawUiState = (storageKey: string) => {
    memoryUiStateMap.delete(storageKey);

    const storage = getStorage();
    if (!storage) {
        return;
    }

    try {
        storage.removeItem(storageKey);
    } catch (error) {
        console.warn(`Failed to clear plugin UI state for ${storageKey}`, error);
    }
};

const resolveSeedState = <T,>(
    storageKey: string,
    initialState: T | (() => T)
): T => {
    const resolvedState = resolveInitialState(initialState);
    const validState = ensureValidUiStateValue(resolvedState, storageKey, 'initialState');
    if (validState === null) {
        throw new Error(`usePluginUiState initialState for ${storageKey} is invalid`);
    }
    return validState;
};

const readUiState = <T,>(
    storageKey: string,
    initialState: T | (() => T)
): T => {
    const rawValue = readRawUiState(storageKey);
    if (rawValue === null) {
        return resolveSeedState(storageKey, initialState);
    }

    try {
        const parsedValue = JSON.parse(rawValue) as unknown;
        if (!isSerializableUiStateValue(parsedValue)) {
            console.warn(`Discarded invalid plugin UI state for ${storageKey}`);
            removeRawUiState(storageKey);
            return resolveSeedState(storageKey, initialState);
        }

        return parsedValue as T;
    } catch (error) {
        console.warn(`Failed to parse plugin UI state for ${storageKey}`, error);
        removeRawUiState(storageKey);
        return resolveSeedState(storageKey, initialState);
    }
};

export const resetPluginUiStateCacheForTests = () => {
    memoryUiStateMap.clear();
};

export interface PluginUiStateControls<T> {
    state: T;
    setState: (nextValue: UiStateUpdate<T>) => void;
    resetState: () => void;
}

export const usePluginUiState = <T,>(
    stateKey: string,
    initialState: PluginUiStateSerializable<T> | (() => PluginUiStateSerializable<T>)
): PluginUiStateControls<PluginUiStateSerializable<T>> => {
    type State = PluginUiStateSerializable<T>;

    const instance = usePluginRuntimeInstanceContext();
    const initialStateRef = useRef<State | (() => State)>(initialState);

    const storageKey = buildPluginUiStateStorageKey(instance, stateKey);
    const [state, setStateValue] = useState<State>(() => readUiState<State>(storageKey, initialState));

    useEffect(() => {
        initialStateRef.current = initialState;
    }, [initialState]);

    useEffect(() => {
        setStateValue(readUiState<State>(storageKey, initialStateRef.current));
    }, [storageKey]);

    const setState = useCallback((nextValue: UiStateUpdate<State>) => {
        setStateValue((currentValue) => {
            const resolvedValue = typeof nextValue === 'function'
                ? (nextValue as (currentState: State) => State)(currentValue)
                : nextValue;
            const validValue = ensureValidUiStateValue<State>(resolvedValue, storageKey, 'nextState');
            if (validValue === null) {
                return currentValue;
            }

            try {
                writeRawUiState(storageKey, JSON.stringify(validValue));
            } catch (error) {
                console.warn(`Failed to serialize plugin UI state for ${storageKey}`, error);
                return currentValue;
            }
            return validValue;
        });
    }, [storageKey]);

    const resetState = useCallback(() => {
        removeRawUiState(storageKey);
        setStateValue(resolveSeedState<State>(storageKey, initialStateRef.current));
    }, [storageKey]);

    return {
        state,
        setState,
        resetState,
    };
};
