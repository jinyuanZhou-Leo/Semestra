// input:  [dashboard widget actions (including layout sync/commit callbacks) and settings section nodes passed from homepage pages]
// output: [`BuiltinTabProvider`, `useBuiltinTabContext()`, and built-in tab context types]
// pos:    [Bridge context consumed by builtin dashboard/settings tab implementations with split layout sync and persistence actions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { createContext, useContext } from 'react';
import type { DeviceLayoutMode, WidgetItem } from '../components/widgets/DashboardGrid';
import type { Layout } from 'react-grid-layout';

type DashboardContextValue = {
    widgets: WidgetItem[];
    onAddWidgetClick: () => void;
    onRemoveWidget: (id: string) => void;
    onEditWidget: (widget: WidgetItem) => void;
    onUpdateWidget: (id: string, data: any) => Promise<void>;
    onUpdateWidgetDebounced?: (id: string, data: any) => void;
    onLayoutChange: (layout: Layout, deviceMode: DeviceLayoutMode, maxCols: number) => void;
    onLayoutCommit?: (layout: Layout, deviceMode: DeviceLayoutMode, maxCols: number) => void;
    semesterId?: string;
    courseId?: string;
    updateCourse?: (updates: any) => void;
};

type SettingsContextValue = {
    content: React.ReactNode;
    extraSections?: React.ReactNode;
};

export type BuiltinTabContextValue = {
    isLoading: boolean;
    dashboard: DashboardContextValue;
    settings: SettingsContextValue;
};

const BuiltinTabContext = createContext<BuiltinTabContextValue | null>(null);

export const BuiltinTabProvider: React.FC<{ value: BuiltinTabContextValue; children: React.ReactNode }> = ({ value, children }) => {
    return (
        <BuiltinTabContext.Provider value={value}>
            {children}
        </BuiltinTabContext.Provider>
    );
};

export const useBuiltinTabContext = () => {
    const context = useContext(BuiltinTabContext);
    if (!context) {
        throw new Error('useBuiltinTabContext must be used within BuiltinTabProvider');
    }
    return context;
};
