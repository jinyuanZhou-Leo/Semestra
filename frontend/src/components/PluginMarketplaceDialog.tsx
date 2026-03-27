// input:  [plugin marketplace items, shared app empty states, responsive dialog-drawer wrapper, shadcn input/scroll-area/button primitives, and add-plugin callbacks]
// output: [`PluginMarketplaceDialog` component]
// pos:    [Reusable searchable marketplace overlay for Program plugin install flows with responsive dialog-drawer composition, shared empty states, and disabled installed rows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useDeferredValue, useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";

import { AppEmptyState } from "@/components/AppEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

import { IconCircle } from "./IconCircle";
import { ResponsiveDialogDrawer } from "./ResponsiveDialogDrawer";

export interface PluginMarketplaceItem {
  pluginId: string;
  displayName: string;
  description: string;
  author: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string | null;
  label: string;
}

interface PluginMarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  searchPlaceholder: string;
  emptyLabel: string;
  noResultsLabel: string;
  items: PluginMarketplaceItem[];
  pendingPluginId?: string | null;
  onSelect: (pluginId: string) => Promise<void> | void;
}

export const PluginMarketplaceDialog: React.FC<PluginMarketplaceDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  searchPlaceholder,
  emptyLabel,
  noResultsLabel,
  items,
  pendingPluginId,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const visibleItems = useMemo(() => {
    if (!deferredQuery) return items;
    return items.filter((item) => [
      item.displayName,
      item.description,
      item.author,
    ].join(" ").toLowerCase().includes(deferredQuery));
  }, [deferredQuery, items]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <ResponsiveDialogDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      desktopContentClassName="gap-0 overflow-hidden border-border/70 p-0 sm:max-w-3xl h-[640px] flex flex-col"
      mobileContentClassName="gap-0 overflow-hidden border-border/70 p-0 h-[85vh] max-h-[85vh] flex flex-col"
      desktopHeaderClassName="border-b border-border/70 px-6 py-5 pr-14 flex-none"
      mobileHeaderClassName="border-b border-border/70 px-6 py-5 flex-none"
      titleClassName="text-xl"
    >
        <div className="border-b border-border/70 px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 px-6 py-5">
          {items.length === 0 ? (
            <AppEmptyState
              scenario="create"
              size="modal"
              title="No plugins available"
              description={emptyLabel}
              className="h-full"
            />
          ) : visibleItems.length === 0 ? (
            <AppEmptyState
              scenario="no-results"
              size="modal"
              title="No matching plugins"
              description={noResultsLabel}
              className="h-full"
            />
          ) : (
            <ScrollArea className="h-full pr-3">
              <div className="overflow-hidden rounded-2xl border border-border/70">
                {visibleItems.map((item, index) => {
                  const isPending = pendingPluginId === item.pluginId;
                  return (
                    <div
                      key={item.pluginId}
                      className={`flex items-start justify-between gap-4 bg-background px-4 py-4 ${
                        index === 0 ? "" : "border-t border-border/70"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <IconCircle icon={item.icon} label={item.displayName} size={34} className="bg-muted text-foreground" />
                        <div className="min-w-0 space-y-1.5">
                          <div className="text-sm font-medium">{item.displayName}</div>
                          <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                          <div className="text-xs text-muted-foreground">By {item.author}</div>
                          {item.disabledReason ? (
                            <div className="text-xs text-amber-700 dark:text-amber-300">{item.disabledReason}</div>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={item.disabled ? "outline" : "default"}
                        disabled={item.disabled || isPending}
                        onClick={() => {
                          if (item.disabled || isPending) return;
                          void Promise.resolve(onSelect(item.pluginId));
                        }}
                      >
                        {isPending ? <Spinner className="mr-2" /> : <PackagePlus className="mr-2 h-4 w-4" />}
                        {isPending ? "Working..." : item.label}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
    </ResponsiveDialogDrawer>
  );
};
