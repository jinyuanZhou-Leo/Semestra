import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWidgetRegistry, type WidgetContext, canAddWidget } from '../services/widgetRegistry';
import { IconCircle } from './IconCircle';
import type { WidgetItem } from './widgets/DashboardGrid';
import { cn } from '@/lib/utils';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (type: string, title?: string) => void;
    context: WidgetContext;
    widgets: WidgetItem[];
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAdd, context, widgets }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    // Use reactive hook - automatically updates when plugins are registered
    const allWidgets = useWidgetRegistry();

    const availableWidgets = useMemo(() => {
        const counts = new Map<string, number>();
        widgets.forEach((widget) => {
            counts.set(widget.type, (counts.get(widget.type) ?? 0) + 1);
        });

        return allWidgets.filter((definition) => {
            const currentCount = counts.get(definition.type) ?? 0;
            return canAddWidget(definition, context, currentCount);
        });
    }, [context, widgets, allWidgets]);

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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="border-b px-6 py-4 flex-none">
                    <DialogTitle className="text-base font-semibold">Add Widget</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {availableWidgets.length === 0 && (
                            <div className="col-span-full text-center text-muted-foreground py-4">
                                No widgets available for this dashboard.
                            </div>
                        )}
                        {availableWidgets.map((widget) => (
                            <div
                                key={widget.type}
                                onClick={() => setSelectedType(widget.type)}
                                className={cn(
                                    "cursor-pointer rounded-lg border-2 p-4 transition-all duration-200",
                                    "hover:border-primary/50 hover:bg-accent/50",
                                    selectedType === widget.type
                                        ? "border-primary bg-accent"
                                        : "border-border bg-card"
                                )}
                            >
                                <div className="mb-2 flex items-center gap-2">
                                    <IconCircle icon={widget.icon} label={widget.name} size={32} />
                                </div>
                                <div className="font-semibold mb-1 truncate">{widget.name}</div>
                                <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                    {widget.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-none p-6 pt-0 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button disabled={!selectedType} onClick={handleAdd}>Add to Dashboard</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
