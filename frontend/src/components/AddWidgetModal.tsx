import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { WidgetRegistry, type WidgetContext, canAddWidget } from '../services/widgetRegistry';
import { IconCircle } from './IconCircle';
import type { WidgetItem } from './widgets/DashboardGrid';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (type: string, title?: string) => void;
    context: WidgetContext;
    widgets: WidgetItem[];
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAdd, context, widgets }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const availableWidgets = useMemo(() => {
        const counts = new Map<string, number>();
        widgets.forEach((widget) => {
            counts.set(widget.type, (counts.get(widget.type) ?? 0) + 1);
        });

        return WidgetRegistry.getAll().filter((definition) => {
            const currentCount = counts.get(definition.type) ?? 0;
            return canAddWidget(definition, context, currentCount);
        });
    }, [context, widgets]);

    useEffect(() => {
        if (selectedType && !availableWidgets.some((widget) => widget.type === selectedType)) {
            setSelectedType(null);
        }
    }, [availableWidgets, selectedType]);

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
                {availableWidgets.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '1rem' }}>
                        No widgets available for this dashboard.
                    </div>
                )}
                {availableWidgets.map((widget) => (
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
                        <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <IconCircle icon={widget.icon} label={widget.name} size={32} />
                        </div>
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
