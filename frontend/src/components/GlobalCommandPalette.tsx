// input:  [open-state control, grouped command descriptors with optional structured metadata, optional lazy child-navigation pages, search-state-aware recommendation vs relevance ordering, and shadcn command/dialog primitives]
// output: [`GlobalCommandPalette` component plus reusable command item/group/page types]
// pos:    [Shared authenticated command center that renders grouped root actions plus lazy-loaded account-navigation pickers with structured command-row metadata, manual search relevance ranking, and mixed icon-source support inside a global shadcn command dialog]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";
import { ChevronLeft, LoaderCircle, SearchIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";

export type LayoutCommandBadge = {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
  className?: string;
  style?: React.CSSProperties;
};

export type LayoutCommandIcon = LucideIcon | React.ReactNode;

export type LayoutCommandItem = {
  id: string;
  title: string;
  description?: string;
  metaText?: string;
  badges?: LayoutCommandBadge[];
  keywords?: string[];
  shortcut?: string;
  icon?: LayoutCommandIcon;
  childPage?: LayoutCommandPage;
  onSelect: () => void | Promise<void>;
};

export type LayoutCommandGroup = {
  heading: string;
  items: LayoutCommandItem[];
};

export type LayoutCommandPage = {
  id: string;
  title: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadItems: () => Promise<LayoutCommandItem[]>;
};

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: LayoutCommandGroup[];
}

type RankedCommandItem = LayoutCommandItem & {
  score: number;
  originalIndex: number;
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const buildSearchHaystack = (item: LayoutCommandItem) => [
  item.title,
  item.metaText,
  item.description,
  ...(item.keywords ?? []),
  ...(item.badges?.map((badge) => badge.label) ?? []),
]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();

const scoreCommandItem = (item: LayoutCommandItem, query: string) => {
  if (!query) {
    return 1;
  }

  const normalizedTitle = item.title.toLowerCase();
  const normalizedMetaText = item.metaText?.toLowerCase() ?? "";
  const normalizedDescription = item.description?.toLowerCase() ?? "";
  const normalizedKeywords = (item.keywords ?? []).join(" ").toLowerCase();
  const normalizedBadges = (item.badges?.map((badge) => badge.label).join(" ") ?? "").toLowerCase();
  const haystack = [normalizedTitle, normalizedMetaText, normalizedDescription, normalizedKeywords, normalizedBadges]
    .filter(Boolean)
    .join(" ");

  if (!haystack.includes(query)) {
    return 0;
  }

  let score = 1;

  if (normalizedTitle === query) score += 100;
  if (normalizedTitle.startsWith(query)) score += 60;
  if (normalizedTitle.includes(query)) score += 30;
  if (normalizedMetaText.startsWith(query)) score += 24;
  if (normalizedMetaText.includes(query)) score += 12;
  if (normalizedKeywords.includes(query)) score += 10;
  if (normalizedDescription.includes(query)) score += 6;
  if (normalizedBadges.includes(query)) score += 4;

  return score;
};

const renderCommandIcon = (icon: LayoutCommandIcon | undefined) => {
  if (!icon) {
    return null;
  }

  if (React.isValidElement(icon)) {
    return icon;
  }

  const Icon = icon as LucideIcon;
  return <Icon />;
};

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  open,
  onOpenChange,
  groups,
}) => {
  const rootSearchInputRef = React.useRef<HTMLInputElement | null>(null);
  const childSearchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [activePage, setActivePage] = React.useState<LayoutCommandPage | null>(null);
  const [pageItems, setPageItems] = React.useState<LayoutCommandItem[]>([]);
  const [isPageLoading, setIsPageLoading] = React.useState(false);
  const [pageErrorMessage, setPageErrorMessage] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const pageCacheRef = React.useRef<Record<string, LayoutCommandItem[]>>({});

  const goToRootCommands = React.useCallback(() => {
    setActivePage(null);
    setPageItems([]);
    setIsPageLoading(false);
    setPageErrorMessage(null);
  }, []);

  React.useEffect(() => {
    if (!open) {
      goToRootCommands();
    }
  }, [goToRootCommands, open]);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  React.useEffect(() => {
    setSearch("");
  }, [activePage?.id]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const focusTarget = activePage ? childSearchInputRef.current : rootSearchInputRef.current;
    if (!focusTarget) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      focusTarget.focus();
      const nextValueLength = focusTarget.value.length;
      focusTarget.setSelectionRange(nextValueLength, nextValueLength);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [activePage, open]);

  React.useEffect(() => {
    if (!activePage) {
      return;
    }

    const cachedItems = pageCacheRef.current[activePage.id];
    if (cachedItems) {
      setPageItems(cachedItems);
      setIsPageLoading(false);
      setPageErrorMessage(null);
      return;
    }

    let isActive = true;
    setPageItems([]);
    setIsPageLoading(true);
    setPageErrorMessage(null);

    void activePage.loadItems()
      .then((items) => {
        if (!isActive) {
          return;
        }

        pageCacheRef.current[activePage.id] = items;
        setPageItems(items);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const message = error instanceof Error
          ? error.message
          : "Failed to load navigation items.";
        setPageErrorMessage(message);
      })
      .finally(() => {
        if (!isActive) {
          return;
        }

        setIsPageLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [activePage]);

  React.useEffect(() => {
    if (!open || !activePage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      goToRootCommands();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [activePage, goToRootCommands, open]);

  const normalizedSearch = normalizeSearchText(search);
  const visibleGroups = React.useMemo(() => {
    const rankedGroups = groups
      .map((group, groupIndex) => {
        const rankedItems = group.items
          .map((item, itemIndex) => ({
            ...item,
            score: scoreCommandItem(item, normalizedSearch),
            originalIndex: itemIndex,
          }))
          .filter((item) => item.score > 0);

        if (rankedItems.length === 0) {
          return null;
        }

        const sortedItems = normalizedSearch
          ? [...rankedItems].sort((left, right) => (
            right.score - left.score || left.originalIndex - right.originalIndex
          ))
          : rankedItems;

        return {
          heading: group.heading,
          originalIndex: groupIndex,
          maxScore: Math.max(...rankedItems.map((item) => item.score)),
          items: sortedItems,
        };
      })
      .filter((group): group is { heading: string; originalIndex: number; maxScore: number; items: RankedCommandItem[] } => group !== null);

    if (!normalizedSearch) {
      return rankedGroups;
    }

    return rankedGroups.sort((left, right) => (
      right.maxScore - left.maxScore || left.originalIndex - right.originalIndex
    ));
  }, [groups, normalizedSearch]);
  const visiblePageItems = React.useMemo(() => {
    const rankedItems = pageItems
      .map((item, itemIndex) => ({
        ...item,
        score: scoreCommandItem(item, normalizedSearch),
        originalIndex: itemIndex,
      }))
      .filter((item) => item.score > 0);

    if (!normalizedSearch) {
      return rankedItems;
    }

    return rankedItems.sort((left, right) => (
      right.score - left.score || left.originalIndex - right.originalIndex
    ));
  }, [normalizedSearch, pageItems]);
  const commandScopeKey = activePage?.id ?? "root";
  const emptyMessage = activePage
    ? pageErrorMessage ?? (isPageLoading ? "Loading navigation items..." : activePage.emptyMessage)
    : "No matching command found.";

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global Command Palette"
      description="Search for a page to navigate to or an action to run."
    >
      <Command key={commandScopeKey} shouldFilter={false}>
        {activePage ? (
          <div className="flex items-center gap-1.5 p-1 pb-0">
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input/30 bg-input/30 text-muted-foreground transition-colors outline-none hover:text-foreground"
              onClick={goToRootCommands}
            >
              <ChevronLeft />
              <span className="sr-only">Back to Commands</span>
            </button>
            <InputGroup className="h-8 flex-1 rounded-lg border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
              <InputGroupAddon align="inline-start">
                <SearchIcon className="size-4 shrink-0 opacity-50" />
              </InputGroupAddon>
              <CommandPrimitive.Input
                ref={childSearchInputRef}
                data-slot="command-input"
                className="flex-1 bg-transparent pl-1.5 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={activePage.searchPlaceholder}
                value={search}
                onValueChange={setSearch}
              />
            </InputGroup>
          </div>
        ) : (
          <CommandInput
            ref={rootSearchInputRef}
            placeholder="Search pages and actions..."
            value={search}
            onValueChange={setSearch}
          />
        )}
        <CommandList>
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          {activePage ? (
            <CommandGroup heading={activePage.title}>
              {isPageLoading ? (
                <CommandItem disabled>
                  <LoaderCircle className="animate-spin" />
                  <span>Loading...</span>
                </CommandItem>
              ) : null}
              {visiblePageItems.map((item) => {
                return (
                  <CommandItem
                    key={item.id}
                    value={buildSearchHaystack(item)}
                    onSelect={() => {
                      onOpenChange(false);
                      void item.onSelect();
                    }}
                  >
                    {renderCommandIcon(item.icon)}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      {item.metaText ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.metaText}
                        </span>
                      ) : null}
                      {item.badges?.map((badge) => (
                        <Badge
                          key={`${item.id}-${badge.label}`}
                          variant={badge.variant ?? "outline"}
                          className={badge.className ?? "h-5 shrink-0 px-1.5 text-[11px]"}
                          style={badge.style}
                        >
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                    {item.shortcut ? (
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : (
            visibleGroups.map((group, groupIndex) => (
              <React.Fragment key={group.heading}>
                <CommandGroup heading={group.heading}>
                  {group.items.map((item) => {
                    return (
                      <CommandItem
                        key={item.id}
                        value={buildSearchHaystack(item)}
                        onSelect={() => {
                          if (item.childPage) {
                            setActivePage(item.childPage);
                            return;
                          }

                          onOpenChange(false);
                          void item.onSelect();
                        }}
                      >
                        {renderCommandIcon(item.icon)}
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate font-medium">{item.title}</span>
                          {item.metaText ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.metaText}
                            </span>
                          ) : null}
                          {item.badges?.map((badge) => (
                            <Badge
                              key={`${item.id}-${badge.label}`}
                              variant={badge.variant ?? "outline"}
                              className={badge.className ?? "h-5 shrink-0 px-1.5 text-[11px]"}
                              style={badge.style}
                            >
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                        {item.shortcut ? (
                          <CommandShortcut>{item.shortcut}</CommandShortcut>
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {groupIndex < visibleGroups.length - 1 ? <CommandSeparator /> : null}
              </React.Fragment>
            ))
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};
