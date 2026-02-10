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
import { useTabRegistry, type TabContext } from '../services/tabRegistry';
import { IconCircle } from './IconCircle';
import type { TabItem } from '../hooks/useDashboardTabs';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { canAddTabCatalogItem, ensureTabPluginByTypeLoaded, getTabCatalog } from '../plugins/runtime';
import { reportError } from '../services/appStatus';

interface AddTabModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (type: string) => void;
    context: TabContext;
    tabs: TabItem[];
}

export const AddTabModal: React.FC<AddTabModalProps> = ({ isOpen, onClose, onAdd, context, tabs }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddingPlugin, setIsAddingPlugin] = useState(false);

    // Reactive hook updates names/icons when a plugin finishes loading.
    const registeredTabs = useTabRegistry();
    const registeredTabMap = useMemo(
        () => new Map(registeredTabs.map((definition) => [definition.type, definition])),
        [registeredTabs]
    );
    const tabCatalog = useMemo(() => getTabCatalog(context), [context]);

    const availableTabs = useMemo(() => {
        const counts = new Map<string, number>();
        tabs.forEach(tab => {
            counts.set(tab.type, (counts.get(tab.type) ?? 0) + 1);
        });

        return tabCatalog.filter((item) => {
            if (item.type === 'builtin-academic-timetable') {
                return false;
            }
            const currentCount = counts.get(item.type) ?? 0;
            return canAddTabCatalogItem(item, context, currentCount);
        });
    }, [context, tabs, tabCatalog]);

    // Filter tabs based on search query
    const filteredTabs = useMemo(() => {
        if (!searchQuery.trim()) {
            return availableTabs;
        }
        const query = searchQuery.toLowerCase();
        return availableTabs.filter((tab) =>
            tab.name.toLowerCase().includes(query) ||
            (tab.description || "").toLowerCase().includes(query)
        );
    }, [availableTabs, searchQuery]);

    useEffect(() => {
        if (selectedType && !availableTabs.some(tab => tab.type === selectedType)) {
            setSelectedType(null);
        }
    }, [availableTabs, selectedType]);

    const handleAdd = async () => {
        if (!selectedType || isAddingPlugin) return;

        setIsAddingPlugin(true);
        try {
            await ensureTabPluginByTypeLoaded(selectedType);
            onAdd(selectedType);
            onClose();
            setSelectedType(null);
            setSearchQuery('');
        } catch (error) {
            console.error(`Failed to load tab plugin for type: ${selectedType}`, error);
            reportError('Failed to load tab plugin. Please try again.');
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
                    <DialogTitle>Add Tab</DialogTitle>
                    <DialogDescription>
                        Search and select a tab to add to your dashboard.
                    </DialogDescription>
                </DialogHeader>

                {/* Search Input */}
                <div className="px-6 pb-3 flex-none">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search tabs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Tab List - Fixed Height */}
                <div className="flex-1 px-6 pb-4 min-h-0">
                    {availableTabs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                            No tabs available for this dashboard.
                        </div>
                    ) : filteredTabs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                            No tabs match your search.
                        </div>
                    ) : (
                        <ScrollArea className="h-full pr-3">
                            <div className="space-y-2">
                                {filteredTabs.map((tab) => {
                                    const registeredDefinition = registeredTabMap.get(tab.type);
                                    const displayName = registeredDefinition?.name ?? tab.name;
                                    const displayDescription = registeredDefinition?.description ?? tab.description;
                                    const displayIcon = registeredDefinition?.icon ?? tab.icon;

                                    return (
                                    <button
                                        key={tab.type}
                                        type="button"
                                        onClick={() => setSelectedType(tab.type)}
                                        className={cn(
                                            "w-full text-left rounded-lg border-2 p-3 transition-all duration-200",
                                            "hover:border-primary/50 hover:bg-accent/50",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            selectedType === tab.type
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
                        {isAddingPlugin ? 'Loading Plugin...' : 'Add Tab'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
