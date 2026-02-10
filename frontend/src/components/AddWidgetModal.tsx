import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWidgetRegistry, type WidgetContext } from '../services/widgetRegistry';
import { IconCircle } from './IconCircle';
import type { WidgetItem } from './widgets/DashboardGrid';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { canAddWidgetCatalogItem, getResolvedWidgetMetadataByType, getWidgetCatalog } from '../plugin-system';
import { reportError } from '../services/appStatus';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (type: string, title?: string) => void | Promise<void>;
    context: WidgetContext;
    widgets: WidgetItem[];
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAdd, context, widgets }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddingPlugin, setIsAddingPlugin] = useState(false);

    // Reactive hook updates names/icons when a plugin finishes loading.
    useWidgetRegistry();
    const widgetCatalog = useMemo(() => getWidgetCatalog(context), [context]);

    const availableWidgets = useMemo(() => {
        const counts = new Map<string, number>();
        widgets.forEach((widget) => {
            counts.set(widget.type, (counts.get(widget.type) ?? 0) + 1);
        });

        return widgetCatalog.filter((item) => {
            const currentCount = counts.get(item.type) ?? 0;
            return canAddWidgetCatalogItem(item, context, currentCount);
        });
    }, [context, widgets, widgetCatalog]);

    // Filter widgets based on search query
    const filteredWidgets = useMemo(() => {
        if (!searchQuery.trim()) {
            return availableWidgets;
        }
        const query = searchQuery.toLowerCase();
        return availableWidgets.filter((widget) =>
            widget.name.toLowerCase().includes(query) ||
            (widget.description || "").toLowerCase().includes(query)
        );
    }, [availableWidgets, searchQuery]);

    useEffect(() => {
        if (selectedType && !availableWidgets.some((widget) => widget.type === selectedType)) {
            setSelectedType(null);
        }
    }, [availableWidgets, selectedType]);

    const handleAdd = async () => {
        if (!selectedType || isAddingPlugin) return;

        setIsAddingPlugin(true);
        try {
            await onAdd(selectedType);
            onClose();
            setSelectedType(null);
            setSearchQuery('');
        } catch (error) {
            console.error(`Failed to add widget for type: ${selectedType}`, error);
            reportError('Failed to add widget. Please try again.');
        } finally {
            setIsAddingPlugin(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
            setSelectedType(null);
            setSearchQuery('');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="gap-0 p-0 sm:max-w-xl h-[600px] flex flex-col">
                <DialogHeader className="px-6 pt-6 pb-4 flex-none">
                    <DialogTitle>Add Widget</DialogTitle>
                    <DialogDescription>
                        Search and select a widget to add to your dashboard.
                    </DialogDescription>
                </DialogHeader>

                {/* Search Input */}
                <div className="px-6 pb-3 flex-none">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search widgets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Widget List - Fixed Height */}
                <div className="flex-1 px-6 pb-4 min-h-0">
                    {availableWidgets.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                            No widgets available for this dashboard.
                        </div>
                    ) : filteredWidgets.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                            No widgets match your search.
                        </div>
                    ) : (
                                <ScrollArea className="h-full pr-3 bg-background after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-2.5 after:rounded-md after:bg-muted/40 after:content-[''] [&>[data-slot=scroll-area-scrollbar]]:rounded-md [&>[data-slot=scroll-area-scrollbar]]:bg-muted/40">
                            <div className="space-y-2">
                                {filteredWidgets.map((widget) => {
                                    const metadata = getResolvedWidgetMetadataByType(widget.type);
                                    const displayName = metadata.name ?? widget.name;
                                    const displayDescription = metadata.description ?? widget.description;
                                    const displayIcon = metadata.icon ?? widget.icon;

                                    return (
                                    <button
                                        key={widget.type}
                                        type="button"
                                        onClick={() => setSelectedType(widget.type)}
                                        className={cn(
                                            "w-full text-left rounded-lg border-2 p-3 transition-all duration-200",
                                            "hover:border-primary/50 hover:bg-accent/50",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            selectedType === widget.type
                                                ? "border-primary bg-accent shadow-sm"
                                                : "border-border bg-card"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 mt-0.5">
                                                <IconCircle icon={displayIcon} label={displayName} size={36} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold mb-0.5">{displayName}</div>
                                                <div className="text-sm text-muted-foreground leading-relaxed">
                                                    {displayDescription}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                    );
                                })}
                                    </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="px-6 pb-6 pt-4 flex-none border-t">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button disabled={!selectedType || isAddingPlugin} onClick={handleAdd}>
                        {isAddingPlugin ? 'Adding Widget...' : 'Add Widget'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
