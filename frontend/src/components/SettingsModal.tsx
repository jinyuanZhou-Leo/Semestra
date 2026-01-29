import React from 'react';
import { Modal } from './Modal';
import { Card } from './Card';
import { SettingsForm } from './SettingsForm';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    initialName: string;
    initialSettings?: any; // e.g. credits, scaling table
    onSave: (data: any) => Promise<void>;
    type: 'program' | 'semester' | 'course';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    title,
    initialName,
    initialSettings = {},
    onSave,
    type
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} contentPadding="0">
            <Card>
                <SettingsForm
                    initialName={initialName}
                    initialSettings={initialSettings}
                    onSave={async (data) => {
                        await onSave(data);
                        onClose();
                    }}
                    type={type}
                    showCancel
                    onCancel={onClose}
                />
            </Card>
        </Modal>
    );
};
