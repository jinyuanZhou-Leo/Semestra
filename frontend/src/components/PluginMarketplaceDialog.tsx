// input:  [plugin marketplace items, shared app empty states, responsive dialog-drawer wrapper, shared plugin detail view, shadcn input/scroll-area/button primitives, and add-plugin callbacks]
// output: [`PluginMarketplaceDialog` component]
// pos:    [Reusable searchable marketplace overlay for Program plugin install flows with responsive dialog-drawer composition, App Store-style list-to-detail navigation, shared plugin details, and disabled installed rows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useDeferredValue, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeft, Search } from "lucide-react";

import { AppEmptyState } from "@/components/AppEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

import { IconCircle } from "./IconCircle";
import { PluginDetailsView } from "./PluginDetailsView";
import { ResponsiveDialogDrawer } from "./ResponsiveDialogDrawer";

export interface PluginMarketplaceItem {
  pluginId: string;
  displayName: string;
  description: string;
  longDescription?: string;
  author: string;
  version?: string;
  contexts?: string[];
  availableTabTypes?: string[];
  availableWidgetTypes?: string[];
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
  searchPlaceholder,
  emptyLabel,
  noResultsLabel,
  items,
  pendingPluginId,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const hasSearchQuery = deferredQuery.length > 0;
  const visibleItems = useMemo(() => {
    if (!deferredQuery) return items;
    return items.filter((item) => [
      item.displayName,
      item.description,
      item.author,
    ].join(" ").toLowerCase().includes(deferredQuery));
  }, [deferredQuery, items]);
  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.pluginId === selectedPluginId)
      ?? items.find((item) => item.pluginId === selectedPluginId)
      ?? null,
    [items, selectedPluginId, visibleItems],
  );
  const recommendedItems = useMemo(() => (
    [...items]
      .sort((left, right) => Number(Boolean(left.disabled)) - Number(Boolean(right.disabled)))
      .slice(0, 4)
  ), [items]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setSelectedPluginId(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <ResponsiveDialogDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={selectedItem ? "Plugin Information" : title}
      desktopContentClassName="gap-0 overflow-hidden border-border/70 p-0 sm:max-w-3xl h-[640px] flex flex-col"
      mobileContentClassName="gap-0 overflow-hidden border-border/70 p-0 h-[85vh] max-h-[85vh] flex flex-col"
      desktopHeaderClassName="border-b border-border/70 px-6 py-5 pr-14 flex-none"
      mobileHeaderClassName="border-b border-border/70 px-6 py-5 flex-none"
      titleClassName="text-xl"
    >
      {selectedItem ? (
        <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
          <div className="mb-4 flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => setSelectedPluginId(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1 pr-3">
            <PluginDetailsView
              pluginId={selectedItem.pluginId}
              displayName={selectedItem.displayName}
              description={selectedItem.description}
              longDescription={selectedItem.longDescription}
              author={selectedItem.author}
              version={selectedItem.version}
              icon={selectedItem.icon}
              disabledReason={selectedItem.disabledReason}
              contexts={selectedItem.contexts}
              availableTabTypes={selectedItem.availableTabTypes}
              availableWidgetTypes={selectedItem.availableWidgetTypes}
              actionLabel={selectedItem.label}
              actionDisabled={selectedItem.disabled}
              isActionPending={pendingPluginId === selectedItem.pluginId}
              onAction={() => onSelect(selectedItem.pluginId)}
            />
          </ScrollArea>
        </div>
      ) : (
        <>
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
                <div className="space-y-6">
                  {!hasSearchQuery ? (
                    <section className="space-y-3">
                      <div className="text-sm font-medium text-muted-foreground">Recommended</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {recommendedItems.map((item) => {
                          const isPending = pendingPluginId === item.pluginId;
                          return (
                            <div
                              key={`recommended-${item.pluginId}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`Open recommended details for ${item.displayName}`}
                              className="flex min-h-36 flex-col justify-between rounded-2xl border border-border/70 p-4 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
                              onClick={() => setSelectedPluginId(item.pluginId)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedPluginId(item.pluginId);
                                }
                              }}
                            >
                              <div className="space-y-3">
                                <IconCircle icon={item.icon} label={item.displayName} size={52} className="bg-muted text-foreground ring-1 ring-border/60" />
                                <div className="space-y-1">
                                  <div className="truncate text-base font-semibold text-foreground">{item.displayName}</div>
                                  <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{item.description}</p>
                                </div>
                              </div>
                              <div className="pt-3">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={item.disabled ? "outline" : "secondary"}
                                  className="h-8 rounded-full px-4 text-sm font-medium"
                                  aria-label={item.disabled ? `${item.label} ${item.displayName} in recommended` : `${item.label} ${item.displayName} from recommended`}
                                  disabled={item.disabled || isPending}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (item.disabled || isPending) return;
                                    void Promise.resolve(onSelect(item.pluginId));
                                  }}
                                >
                                  {isPending ? <Spinner className="mr-2" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
                                  {isPending ? "Working..." : item.label}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  <section className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      {hasSearchQuery ? "Search results" : "All plugins"}
                    </div>
                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const isPending = pendingPluginId === item.pluginId;
                        return (
                          <div
                            key={item.pluginId}
                            role="button"
                            tabIndex={0}
                            aria-label={`Open details for ${item.displayName}`}
                            className="flex w-full items-center justify-between gap-4 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                            onClick={() => setSelectedPluginId(item.pluginId)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedPluginId(item.pluginId);
                              }
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <IconCircle icon={item.icon} label={item.displayName} size={56} className="bg-muted text-foreground ring-1 ring-border/60" />
                              <div className="min-w-0 space-y-0.5">
                                <div className="truncate text-lg leading-6 font-semibold text-foreground">{item.displayName}</div>
                                <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{item.description}</p>
                                {item.disabledReason ? (
                                  <div className="pt-0.5 text-xs text-amber-700 dark:text-amber-300">{item.disabledReason}</div>
                                ) : null}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={item.disabled ? "outline" : "secondary"}
                              className="h-8 shrink-0 rounded-full px-4 text-sm font-medium"
                              disabled={item.disabled || isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (item.disabled || isPending) return;
                                void Promise.resolve(onSelect(item.pluginId));
                              }}
                            >
                              {isPending ? <Spinner className="mr-2" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
                              {isPending ? "Working..." : item.label}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </ScrollArea>
            )}
          </div>
        </>
      )}
    </ResponsiveDialogDrawer>
  );
};
