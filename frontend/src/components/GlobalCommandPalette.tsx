// input:  [open-state control, grouped command descriptors, and shadcn command/dialog primitives]
// output: [`GlobalCommandPalette` component plus reusable command item/group types]
// pos:    [Shared authenticated command center that renders grouped navigation and action items inside a global shadcn command dialog]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";
import type { LucideIcon } from "lucide-react";

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

export type LayoutCommandItem = {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  shortcut?: string;
  icon?: LucideIcon;
  onSelect: () => void | Promise<void>;
};

export type LayoutCommandGroup = {
  heading: string;
  items: LayoutCommandItem[];
};

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: LayoutCommandGroup[];
}

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  open,
  onOpenChange,
  groups,
}) => {
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global Command Palette"
      description="Search for a page to navigate to or an action to run."
    >
      <Command>
        <CommandInput placeholder="Search pages and actions..." />
        <CommandList>
          <CommandEmpty>No matching command found.</CommandEmpty>
          {visibleGroups.map((group, groupIndex) => (
            <React.Fragment key={group.heading}>
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const value = [item.title, item.description, ...(item.keywords ?? [])]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <CommandItem
                      key={item.id}
                      value={value}
                      onSelect={() => {
                        onOpenChange(false);
                        void item.onSelect();
                      }}
                    >
                      {Icon ? <Icon /> : null}
                      <span>{item.title}</span>
                      {item.shortcut ? (
                        <CommandShortcut>{item.shortcut}</CommandShortcut>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {groupIndex < visibleGroups.length - 1 ? <CommandSeparator /> : null}
            </React.Fragment>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};
