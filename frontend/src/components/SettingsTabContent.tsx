import React from 'react';
import { SettingsForm } from './SettingsForm';

interface SettingsTabContentProps {
    title?: string;
    initialName: string;
    initialSettings?: any;
    onSave: (data: any) => Promise<void>;
    type: 'program' | 'semester' | 'course';
    extraSections?: React.ReactNode;
}

export const SettingsTabContent: React.FC<SettingsTabContentProps> = ({
    title = 'Settings',
    initialName,
    initialSettings,
    onSave,
    type,
    extraSections
}) => {
    return (
        <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
                <h2 style={{ marginTop: 0 }}>{title}</h2>
                <SettingsForm
                    initialName={initialName}
                    initialSettings={initialSettings}
                    onSave={onSave}
                    type={type}
                    submitLabel="Save Settings"
                />
            </div>
            {extraSections}
        </div>
    );
};
