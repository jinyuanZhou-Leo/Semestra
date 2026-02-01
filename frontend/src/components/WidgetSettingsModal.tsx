import React from 'react';
import { Modal } from './Modal';
import { WidgetRegistry } from '../services/widgetRegistry';

interface WidgetSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    widget: any;
    onSave: (id: string, data: any) => Promise<void>;
}

export const WidgetSettingsModal: React.FC<WidgetSettingsModalProps> = ({
    isOpen,
    onClose,
    widget,
    onSave
}) => {
    const widgetDefinition = WidgetRegistry.get(widget?.type);
    const SettingsComponent = widgetDefinition?.SettingsComponent;

    const handleSave = async (newSettings: any) => {
        await onSave(widget.id, {
            settings: JSON.stringify(newSettings)
        });
        onClose();
    };

    if (!SettingsComponent) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Widget Settings">
                <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>
                    No settings available for this widget type.
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${widgetDefinition?.name} Settings`}>
            <SettingsComponent
                settings={widget?.settings || {}}
                onSave={handleSave}
                onClose={onClose}
            />
        </Modal>
    );
};
