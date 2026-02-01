import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useTabRegistry, type TabContext, canAddTab } from '../services/tabRegistry';
import { IconCircle } from './IconCircle';
import type { TabItem } from '../hooks/useDashboardTabs';

interface AddTabModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (type: string) => void;
    context: TabContext;
    tabs: TabItem[];
}

export const AddTabModal: React.FC<AddTabModalProps> = ({ isOpen, onClose, onAdd, context, tabs }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    // Use reactive hook - automatically updates when plugins are registered
    const allTabs = useTabRegistry();

    const availableTabs = useMemo(() => {
        const counts = new Map<string, number>();
        tabs.forEach(tab => {
            counts.set(tab.type, (counts.get(tab.type) ?? 0) + 1);
        });
        return allTabs.filter(definition => {
            const currentCount = counts.get(definition.type) ?? 0;
            return canAddTab(definition, context, currentCount);
        });
    }, [context, tabs, allTabs]);

    useEffect(() => {
        if (selectedType && !availableTabs.some(tab => tab.type === selectedType)) {
            setSelectedType(null);
        }
    }, [availableTabs, selectedType]);

    useEffect(() => {
        if (!isOpen) setSelectedType(null);
    }, [isOpen]);

    const handleAdd = () => {
        if (selectedType) {
            onAdd(selectedType);
            onClose();
            setSelectedType(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Tab">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {availableTabs.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '1rem' }}>
                        No tabs available for this dashboard.
                    </div>
                )}
                {availableTabs.map(tab => (
                    <div
                        key={tab.type}
                        onClick={() => setSelectedType(tab.type)}
                        style={{
                            border: `2px solid ${selectedType === tab.type ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            cursor: 'pointer',
                            backgroundColor: selectedType === tab.type ? 'var(--color-bg-tertiary)' : 'var(--color-bg-primary)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <IconCircle icon={tab.icon} label={tab.name} size={32} />
                        </div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{tab.name}</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{tab.description}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button disabled={!selectedType} onClick={handleAdd}>Add Tab</Button>
            </div>
        </Modal>
    );
};
