import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTabRegistry, type TabContext, canAddTab } from '../services/tabRegistry';
import { IconCircle } from './IconCircle';
import type { TabItem } from '../hooks/useDashboardTabs';
import { cn } from '@/lib/utils';

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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="border-b px-6 py-4 flex-none">
                    <DialogTitle className="text-base font-semibold">Add Tab</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {availableTabs.length === 0 && (
                            <div className="col-span-full text-center text-muted-foreground py-4">
                                No tabs available for this dashboard.
                            </div>
                        )}
                        {availableTabs.map(tab => (
                            <div
                                key={tab.type}
                                onClick={() => setSelectedType(tab.type)}
                                className={cn(
                                    "cursor-pointer rounded-lg border-2 p-4 transition-all duration-200",
                                    "hover:border-primary/50 hover:bg-accent/50",
                                    selectedType === tab.type
                                        ? "border-primary bg-accent"
                                        : "border-border bg-card"
                                )}
                            >
                                <div className="mb-2 flex items-center gap-2">
                                    <IconCircle icon={tab.icon} label={tab.name} size={32} />
                                </div>
                                <div className="font-semibold mb-1 truncate">{tab.name}</div>
                                <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                    {tab.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-none p-6 pt-0 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button disabled={!selectedType} onClick={handleAdd}>Add Tab</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
