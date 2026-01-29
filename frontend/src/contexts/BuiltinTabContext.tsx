import React, { createContext, useContext } from 'react';
import type { WidgetItem } from '../components/widgets/DashboardGrid';

type DashboardContextValue = {
    widgets: WidgetItem[];
    onAddWidgetClick: () => void;
    onRemoveWidget: (id: string) => void;
    onEditWidget: (widget: WidgetItem) => void;
    onUpdateWidget: (id: string, data: any) => Promise<void>;
    onUpdateWidgetDebounced?: (id: string, data: any) => void;
    onLayoutChange: (layouts: any) => void;
    semesterId?: string;
    courseId?: string;
    updateCourseField?: (field: string, value: any) => void;
};

type SettingsContextValue = {
    initialName: string;
    initialSettings?: any;
    onSave: (data: any) => Promise<void>;
    type: 'semester' | 'course';
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
