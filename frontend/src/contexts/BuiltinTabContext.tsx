// input:  [dashboard widget actions (including unavailable-widget delete routing and layout sync/commit callbacks), optional overview nodes, and settings section nodes passed from homepage pages]
// output: [`BuiltinTabProvider`, `useBuiltinDashboardContext()`, `useBuiltinSettingsContext()`, and built-in tab context types]
// pos:    [Bridge context consumed by builtin dashboard/settings tab implementations with split layout sync, persistence actions, and dashboard overview slots.
//          Dashboard and settings are intentionally split into two separate contexts so that dashboard state changes (widget drag, layout update)
//          do not cause the settings tab to re-render, and vice-versa.]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { createContext, useContext } from 'react';
import type { DeviceLayoutMode, WidgetItem } from '../components/widgets/DashboardGrid';
import type { WidgetUpdateData } from '../services/widgetRegistry';
import type { Layout } from 'react-grid-layout';

type DashboardContextValue = {
    widgets: WidgetItem[];
    overview?: React.ReactNode;
    onAddWidgetClick: () => void;
    onRemoveWidget: (id: string) => void;
    onRemoveUnavailableWidget: (id: string) => void;
    onEditWidget: (widget: WidgetItem) => void;
    onUpdateWidget: (id: string, data: WidgetUpdateData) => Promise<void>;
    onUpdateWidgetDebounced?: (id: string, data: WidgetUpdateData) => void;
    onLayoutChange: (layout: Layout, deviceMode: DeviceLayoutMode, maxCols: number) => void;
    onLayoutCommit?: (layout: Layout, deviceMode: DeviceLayoutMode, maxCols: number) => void;
    semesterId?: string;
    courseId?: string;
    updateCourse?: (updates: Record<string, unknown>) => void;
};

type SettingsContextValue = {
    content: React.ReactNode;
    extraSections?: React.ReactNode;
};

export type BuiltinDashboardContextValue = {
    isLoading: boolean;
    dashboard: DashboardContextValue;
};

export type BuiltinSettingsContextValue = {
    isLoading: boolean;
    settings: SettingsContextValue;
};

/** @deprecated Use BuiltinDashboardContextValue or BuiltinSettingsContextValue directly. */
export type BuiltinTabContextValue = BuiltinDashboardContextValue & { settings: SettingsContextValue };

const BuiltinDashboardContext = createContext<BuiltinDashboardContextValue | null>(null);
const BuiltinSettingsContext = createContext<BuiltinSettingsContextValue | null>(null);

interface BuiltinTabProviderProps {
    dashboard: BuiltinDashboardContextValue;
    settings: BuiltinSettingsContextValue;
    children: React.ReactNode;
}

export const BuiltinTabProvider: React.FC<BuiltinTabProviderProps> = ({ dashboard, settings, children }) => {
    return (
        <BuiltinDashboardContext.Provider value={dashboard}>
            <BuiltinSettingsContext.Provider value={settings}>
                {children}
            </BuiltinSettingsContext.Provider>
        </BuiltinDashboardContext.Provider>
    );
};

export const useBuiltinDashboardContext = (): BuiltinDashboardContextValue => {
    const context = useContext(BuiltinDashboardContext);
    if (!context) {
        throw new Error('useBuiltinDashboardContext must be used within BuiltinTabProvider');
    }
    return context;
};

export const useBuiltinSettingsContext = (): BuiltinSettingsContextValue => {
    const context = useContext(BuiltinSettingsContext);
    if (!context) {
        throw new Error('useBuiltinSettingsContext must be used within BuiltinTabProvider');
    }
    return context;
};

/** @deprecated Use useBuiltinDashboardContext or useBuiltinSettingsContext. */
export const useBuiltinTabContext = (): BuiltinTabContextValue => {
    const dashboard = useBuiltinDashboardContext();
    const settings = useBuiltinSettingsContext();
    return { ...dashboard, settings: settings.settings };
};
