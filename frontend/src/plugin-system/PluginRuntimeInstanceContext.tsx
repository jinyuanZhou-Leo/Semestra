// input:  [workspace scope identifiers, slot identifiers, and React context consumers]
// output: [plugin runtime instance context types, provider, and storage key helpers]
// pos:    [Runtime scope boundary shared by plugin UI-state cache and future plugin host capabilities]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { createContext, useContext } from 'react';

export type PluginRuntimeWorkspaceKind = 'semester' | 'course';
export type PluginRuntimeSlotKind = 'tab' | 'widget';

export interface PluginRuntimeInstanceValue {
    workspaceKind: PluginRuntimeWorkspaceKind;
    workspaceId: string;
    slotKind: PluginRuntimeSlotKind;
    slotId: string;
    pluginType?: string;
}

interface PluginRuntimeInstanceProviderProps {
    value: PluginRuntimeInstanceValue;
    children: React.ReactNode;
}

const PluginRuntimeInstanceContext = createContext<PluginRuntimeInstanceValue | null>(null);

export const PLUGIN_UI_STATE_STORAGE_PREFIX = 'semestra.plugin-ui-state.v1';

export const buildPluginUiStateStorageKey = (
    instance: PluginRuntimeInstanceValue,
    stateKey: string
): string => {
    const normalizedStateKey = stateKey.trim();
    if (!normalizedStateKey) {
        throw new Error('usePluginUiState requires a non-empty stateKey');
    }

    return [
        PLUGIN_UI_STATE_STORAGE_PREFIX,
        instance.workspaceKind,
        instance.workspaceId,
        instance.slotKind,
        instance.slotId,
        normalizedStateKey,
    ].join(':');
};

export const PluginRuntimeInstanceProvider: React.FC<PluginRuntimeInstanceProviderProps> = ({ value, children }) => {
    return (
        <PluginRuntimeInstanceContext.Provider value={value}>
            {children}
        </PluginRuntimeInstanceContext.Provider>
    );
};

export const usePluginRuntimeInstanceContext = (): PluginRuntimeInstanceValue => {
    const context = useContext(PluginRuntimeInstanceContext);
    if (!context) {
        throw new Error('usePluginRuntimeInstanceContext must be used within PluginRuntimeInstanceProvider');
    }
    return context;
};
