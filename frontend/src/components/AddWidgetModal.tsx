import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { WidgetRegistry } from '../services/widgetRegistry';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (type: string, title?: string) => void;
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const widgets = WidgetRegistry.getAll();

    const handleAdd = () => {
        if (selectedType) {
            onAdd(selectedType);
            onClose();
            setSelectedType(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Widget">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {widgets.map((widget) => (
                    <div
                        key={widget.type}
                        onClick={() => setSelectedType(widget.type)}
                        style={{
                            border: `2px solid ${selectedType === widget.type ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            cursor: 'pointer',
                            backgroundColor: selectedType === widget.type ? 'var(--color-bg-tertiary)' : 'var(--color-bg-primary)',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{widget.icon}</div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{widget.name}</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{widget.description}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button disabled={!selectedType} onClick={handleAdd}>Add to Dashboard</Button>
            </div>
        </Modal>
    );
};
