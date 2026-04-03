// input:  [visible workspace tabs, active-tab setter, and global dialog confirm/alert hook]
// output: [PluginHostProvider, usePluginHost, and plugin-host jump types]
// pos:    [Host navigation bridge that lets plugins request confirmed tab jumps within the current workspace]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useDialog } from '@/contexts/DialogContext';

export interface PluginHostTabLike {
    id: string;
    type: string;
    title?: string;
}

export type PluginHostJumpTarget = { tabId: string } | { tabType: string };

export interface PluginHostJumpOptions {
    title?: string;
    description?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
}

export interface PluginHostJumpResult {
    status: 'jumped' | 'cancelled' | 'missing' | 'ambiguous';
    tabId?: string;
}

interface PluginHostContextValue {
    jumpToTab: (target: PluginHostJumpTarget, options?: PluginHostJumpOptions) => Promise<PluginHostJumpResult>;
}

interface PluginHostProviderProps {
    visibleTabs: PluginHostTabLike[];
    setActiveTabId: (tabId: string) => void;
    children: React.ReactNode;
}

const PluginHostContext = createContext<PluginHostContextValue | null>(null);

const DEFAULT_CONFIRM_TITLE = 'Jump to tab?';
const DEFAULT_MISSING_TITLE = 'Tab unavailable';
const DEFAULT_AMBIGUOUS_TITLE = 'Multiple tabs match';

const getTabLabel = (tab: PluginHostTabLike) => tab.title?.trim() || tab.type || tab.id;

export const PluginHostProvider: React.FC<PluginHostProviderProps> = ({
    visibleTabs,
    setActiveTabId,
    children,
}) => {
    const { confirm, alert } = useDialog();

    const tabsById = useMemo(() => {
        return new Map(visibleTabs.map((tab) => [tab.id, tab] as const));
    }, [visibleTabs]);

    const tabsByType = useMemo(() => {
        const byType = new Map<string, PluginHostTabLike[]>();
        visibleTabs.forEach((tab) => {
            const existing = byType.get(tab.type);
            if (existing) {
                existing.push(tab);
                return;
            }
            byType.set(tab.type, [tab]);
        });
        return byType;
    }, [visibleTabs]);

    const jumpToTab = useCallback(async (
        target: PluginHostJumpTarget,
        options: PluginHostJumpOptions = {}
    ): Promise<PluginHostJumpResult> => {
        const confirmTitle = options.title ?? DEFAULT_CONFIRM_TITLE;
        const confirmDescription = options.description;
        const missingTitle = options.title ?? DEFAULT_MISSING_TITLE;
        const ambiguousTitle = options.title ?? DEFAULT_AMBIGUOUS_TITLE;

        if ('tabId' in target) {
            const tab = tabsById.get(target.tabId);
            if (!tab) {
                await alert({
                    title: missingTitle,
                    description: confirmDescription ?? 'The requested tab is not available in this workspace.',
                    confirmText: options.confirmText ?? 'OK',
                });
                return { status: 'missing' };
            }

            const shouldJump = await confirm({
                title: confirmTitle,
                description: confirmDescription ?? `Open ${getTabLabel(tab)}?`,
                confirmText: options.confirmText ?? 'Open',
                cancelText: options.cancelText ?? 'Cancel',
            });
            if (!shouldJump) {
                return { status: 'cancelled' };
            }

            setActiveTabId(tab.id);
            return { status: 'jumped', tabId: tab.id };
        }

        const matches = tabsByType.get(target.tabType) ?? [];
        if (matches.length === 0) {
            await alert({
                title: missingTitle,
                description: confirmDescription ?? `The "${target.tabType}" tab is not added in this workspace.`,
                confirmText: options.confirmText ?? 'OK',
            });
            return { status: 'missing' };
        }

        if (matches.length > 1) {
            await alert({
                title: ambiguousTitle,
                description: confirmDescription ?? `Multiple "${target.tabType}" tabs exist. Use tabId instead.`,
                confirmText: options.confirmText ?? 'OK',
            });
            return { status: 'ambiguous' };
        }

        const tab = matches[0];
        const shouldJump = await confirm({
            title: confirmTitle,
            description: confirmDescription ?? `Open ${getTabLabel(tab)}?`,
            confirmText: options.confirmText ?? 'Open',
            cancelText: options.cancelText ?? 'Cancel',
        });
        if (!shouldJump) {
            return { status: 'cancelled' };
        }

        setActiveTabId(tab.id);
        return { status: 'jumped', tabId: tab.id };
    }, [alert, confirm, setActiveTabId, tabsById, tabsByType]);

    const value = useMemo<PluginHostContextValue>(() => ({
        jumpToTab,
    }), [jumpToTab]);

    return (
        <PluginHostContext.Provider value={value}>
            {children}
        </PluginHostContext.Provider>
    );
};

export const usePluginHost = (): PluginHostContextValue => {
    const context = useContext(PluginHostContext);
    if (!context) {
        throw new Error('usePluginHost must be used within PluginHostProvider');
    }
    return context;
};
