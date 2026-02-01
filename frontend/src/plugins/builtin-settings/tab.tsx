import React from 'react';
import { SettingsTabContent } from '../../components/SettingsTabContent';
import { useBuiltinTabContext } from '../../contexts/BuiltinTabContext';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

const BuiltinSettingsTabComponent: React.FC<TabProps> = () => {
    const { isLoading, settings } = useBuiltinTabContext();

    if (isLoading) {
        return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>Loading…</div>;
    }

    return (
        <SettingsTabContent
            title={null}
            initialName={settings.initialName}
            initialSettings={settings.initialSettings}
            onSave={settings.onSave}
            type={settings.type}
            extraSections={settings.extraSections}
        />
    );
};

export const BuiltinSettingsTab = BuiltinSettingsTabComponent;

export const BuiltinSettingsTabDefinition: TabDefinition = {
    type: 'settings',
    name: 'Settings',
    component: BuiltinSettingsTab,
    maxInstances: 0,
    allowedContexts: ['semester', 'course']
};
