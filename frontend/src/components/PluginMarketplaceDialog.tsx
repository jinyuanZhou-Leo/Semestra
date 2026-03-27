// input:  [plugin marketplace items, shadcn dialog/input/scroll-area/button primitives, and add-plugin callbacks]
// output: [`PluginMarketplaceDialog` component]
// pos:    [Reusable searchable marketplace modal for Program plugin install flows with standard shadcn dialog/list composition]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useDeferredValue, useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

import { IconCircle } from "./IconCircle";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-border/70 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
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
        <ScrollArea className="h-[420px]">
          <div className="px-6 py-5">
            {visibleItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </div>
            ) : (
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
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
