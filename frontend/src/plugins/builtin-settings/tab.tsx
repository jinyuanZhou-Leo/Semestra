import React from 'react';
import { SettingsTabContent } from '../../components/SettingsTabContent';
import { useBuiltinTabContext } from '../../contexts/BuiltinTabContext';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

const BuiltinSettingsTabComponent: React.FC<TabProps> = () => {
    const { isLoading, settings } = useBuiltinTabContext();

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">Loading…</div>;
    }

    return (
        <SettingsTabContent
            content={settings.content}
            extraSections={settings.extraSections}
        />
    );
};

export const BuiltinSettingsTab = BuiltinSettingsTabComponent;

export const BuiltinSettingsTabDefinition: TabDefinition = {
    type: 'settings',
    name: 'Settings',
    component: BuiltinSettingsTab,
    maxInstances: 1,
    allowedContexts: ['semester', 'course']
};
