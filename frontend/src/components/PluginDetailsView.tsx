// input:  [plugin identity/capability metadata, plugin catalog metadata helpers, optional action callbacks, shared icon renderer, and shadcn content/collapsible primitives]
// output: [`PluginDetailsView` component]
// pos:    [shared App Store-inspired plugin detail body reused by settings action dialogs and marketplace detail pages, with enlarged plugin identity presentation plus compatibility summary and collapsible tab/widget catalogs]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Blocks,
  BookOpen,
  CalendarRange,
  ChevronDown,
  Code2,
  Puzzle,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { getResolvedTabMetadataByType, getResolvedWidgetMetadataByType } from "@/plugin-system";
import { cn } from "@/lib/utils";

import { IconCircle } from "./IconCircle";

export interface PluginDetailsViewProps {
  pluginId: string;
  displayName: string;
  description: string;
  longDescription?: string;
  author: string;
  version?: string;
  icon?: React.ReactNode;
  disabledReason?: string | null;
  contexts?: string[];
  availableTabTypes?: string[];
  availableWidgetTypes?: string[];
  actionLabel?: string;
  actionPendingLabel?: string;
  actionDisabled?: boolean;
  isActionPending?: boolean;
  onAction?: () => Promise<void> | void;
}

export const PluginDetailsView: React.FC<PluginDetailsViewProps> = ({
  pluginId,
  displayName,
  description,
  longDescription,
  author,
  version,
  icon,
  disabledReason,
  contexts,
  availableTabTypes,
  availableWidgetTypes,
  actionLabel,
  actionPendingLabel = "Working...",
  actionDisabled = false,
  isActionPending = false,
  onAction,
}) => {
  const [tabsOpen, setTabsOpen] = useState(true);
  const [widgetsOpen, setWidgetsOpen] = useState(true);
  const contextEntries = useMemo(() => {
    const orderedContexts = ["program", "semester", "course"];
    return orderedContexts
      .filter((context) => (contexts ?? []).includes(context))
      .map((context) => {
        switch (context) {
          case "program":
            return {
              key: context,
              icon: <Blocks className="h-4 w-4" />,
              label: "Program",
            };
          case "semester":
            return {
              key: context,
              icon: <CalendarRange className="h-4 w-4" />,
              label: "Semester",
            };
          case "course":
            return {
              key: context,
              icon: <BookOpen className="h-4 w-4" />,
              label: "Course",
            };
          default:
            return null;
        }
      })
      .filter(Boolean) as Array<{ key: string; icon: React.ReactNode; label: string }>;
  }, [contexts]);

  const tabEntries = useMemo(
    () => (availableTabTypes ?? []).map((type) => {
      const metadata = getResolvedTabMetadataByType(type);
      return {
        key: type,
        type,
        name: metadata.name ?? type,
        description: metadata.description ?? "No description is available for this tab surface yet.",
        icon: metadata.icon,
      };
    }),
    [availableTabTypes],
  );

  const widgetEntries = useMemo(
    () => (availableWidgetTypes ?? []).map((type) => {
      const metadata = getResolvedWidgetMetadataByType(type);
      return {
        key: type,
        type,
        name: metadata.name ?? type,
        description: metadata.description ?? "No description is available for this widget surface yet.",
        icon: metadata.icon,
      };
    }),
    [availableWidgetTypes],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <IconCircle icon={icon} label={displayName} size={76} className="bg-muted text-foreground ring-1 ring-border/70" />
            <div className="min-w-0 pt-1">
              <h3 className="text-[1.85rem] leading-none font-semibold tracking-tight text-foreground">{displayName}</h3>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">{description}</p>
            </div>
          </div>

          {actionLabel && onAction ? (
            <Button
              type="button"
              className="h-9 shrink-0 rounded-full px-5 text-sm font-semibold"
              disabled={actionDisabled || isActionPending}
              onClick={() => {
                if (actionDisabled || isActionPending) return;
                void Promise.resolve(onAction());
              }}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              {isActionPending ? actionPendingLabel : actionLabel}
            </Button>
          ) : null}
        </div>

        {disabledReason ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">{disabledReason}</p>
        ) : null}
      </div>

      <div className="grid gap-4 border-y border-border/70 py-4 md:grid-cols-4">
        <div className="space-y-1 px-1">
          <div className="text-sm font-medium text-muted-foreground">Developer</div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <span>{author}</span>
          </div>
        </div>
        <div className="space-y-1 px-1">
          <div className="text-sm font-medium text-muted-foreground">Plugin ID</div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            <span>{pluginId}</span>
          </div>
        </div>
        <div className="space-y-1 px-1">
          <div className="text-sm font-medium text-muted-foreground">Version</div>
          <div className="text-sm text-foreground">{version ?? "Workspace"}</div>
        </div>
        <div className="space-y-1 px-1">
          <div className="text-sm font-medium text-muted-foreground">Plugin Components</div>
          <div className="text-sm text-foreground">
            {[
              tabEntries.length > 0 ? `${tabEntries.length} tab${tabEntries.length === 1 ? "" : "s"}` : null,
              widgetEntries.length > 0 ? `${widgetEntries.length} widget${widgetEntries.length === 1 ? "" : "s"}` : null,
            ].filter(Boolean).join(" · ") || "No declared plugin surfaces"}
          </div>
        </div>
      </div>


      <section className="space-y-3">
        <div className="text-sm font-medium text-muted-foreground">About</div>
        <p className="max-w-3xl text-sm leading-7 text-foreground/88">{longDescription || description}</p>
      </section>

      <section className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Puzzle className="h-4 w-4" />
          <span className="text-sm font-medium text-muted-foreground">Compatible with:</span>
        </div>
        {contextEntries.length > 0 ? (
          contextEntries.map((entry, index) => (
            <div key={entry.key} className="flex items-center gap-2">
              <span className="text-muted-foreground">{entry.icon}</span>
              <span className="text-sm text-foreground">{entry.label}</span>
              {index < contextEntries.length - 1 ? <span className="text-muted-foreground">,</span> : null}
            </div>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">No explicit compatibility declared</span>
        )}
      </section>

      <div className="space-y-3">
        <Separator />
        <div className="text-sm font-medium text-muted-foreground">Plugin surfaces</div>
        <CapabilitySection
          title="Tabs"
          count={tabEntries.length}
          open={tabsOpen}
          onOpenChange={setTabsOpen}
          emptyLabel="This plugin does not declare any tab surfaces."
          items={tabEntries}
        />
        <CapabilitySection
          title="Widgets"
          count={widgetEntries.length}
          open={widgetsOpen}
          onOpenChange={setWidgetsOpen}
          emptyLabel="This plugin does not declare any widget surfaces."
          items={widgetEntries}
        />
      </div>
    </div>
  );
};

interface CapabilityItem {
  key: string;
  type: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
}

interface CapabilitySectionProps {
  title: string;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emptyLabel: string;
  items: CapabilityItem[];
}

const CapabilitySection: React.FC<CapabilitySectionProps> = ({
  title,
  count,
  open,
  onOpenChange,
  emptyLabel,
  items,
}) => (
  <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-2xl border border-border/70">
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-sm text-muted-foreground">
            {count > 0 ? `${count} available` : emptyLabel}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent className="border-t border-border/70">
      {items.length > 0 ? (
        <ul className="divide-y divide-border/70">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 px-4 py-3">
              <IconCircle icon={item.icon} label={item.name} size={32} className="bg-muted text-foreground ring-1 ring-border/70" />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="text-sm font-semibold text-foreground">{item.name}</div>
                  <span className="text-xs text-muted-foreground">{item.type}</span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </CollapsibleContent>
  </Collapsible>
);
