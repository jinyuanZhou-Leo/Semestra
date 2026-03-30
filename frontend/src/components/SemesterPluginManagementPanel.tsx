// input:  [Semester plugin activations spanning all Program-enabled plugins, Semester id, plugin-manifest icon helpers, refresh callback, shared settings-section primitives, the shared data-table shell, shared plugin details, and shared row-actions dropdown helpers]
// output: [`SemesterPluginManagementPanel` component]
// pos:    [Semester settings surface for Program-enabled plugin visibility, Semester-level enable/disable state, and reusable plugin info using the shared data-table pattern plus an explicit plugin-table minimum width and a shadcn-style row-actions dropdown]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";

import { getPluginIconById } from "@/plugin-system";
import { queryKeys } from "@/services/queryKeys";

import api, { type SemesterPluginActivation } from "../services/api";
import { DataTable, DataTableActionMenu } from "./DataTable";
import { IconCircle } from "./IconCircle";
import { PluginDetailsView } from "./PluginDetailsView";
import { ResponsiveDialogDrawer } from "./ResponsiveDialogDrawer";
import { SettingsSection } from "./SettingsSection";

interface SemesterPluginManagementPanelProps {
  semesterId: string;
  pluginActivations: SemesterPluginActivation[];
  onChanged?: () => Promise<void> | void;
}

const isLocalDisableReason = (plugin: SemesterPluginActivation) => plugin.availability_reason === "Disabled for this Semester.";
export const SemesterPluginManagementPanel: React.FC<SemesterPluginManagementPanelProps> = ({
  semesterId,
  pluginActivations,
  onChanged,
}) => {
  const queryClient = useQueryClient();
  const [detailPlugin, setDetailPlugin] = useState<SemesterPluginActivation | null>(null);
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null);

  const installedPlugins = useMemo(
    () => pluginActivations,
    [pluginActivations],
  );
  const bulkToggleCandidates = useMemo(
    () => installedPlugins.filter((plugin) => !plugin.locked),
    [installedPlugins],
  );
  const canEnableAll = useMemo(
    () => bulkToggleCandidates.some((plugin) => {
      const localDisableReason = isLocalDisableReason(plugin);
      const blockedByPrerequisite = plugin.available === false && !localDisableReason;
      return !plugin.is_enabled && !blockedByPrerequisite;
    }),
    [bulkToggleCandidates],
  );
  const canDisableAll = useMemo(
    () => bulkToggleCandidates.some((plugin) => plugin.is_enabled),
    [bulkToggleCandidates],
  );
  const areAllBulkToggleCandidatesEnabled = bulkToggleCandidates.length > 0 && bulkToggleCandidates.every((plugin) => plugin.is_enabled);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.semesters.detail(semesterId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.semesters.pluginActivations(semesterId) }),
      queryClient.invalidateQueries({ queryKey: ["courses", "detail"] }),
    ]);
    await onChanged?.();
  };

  const handleToggleEnabled = async (item: SemesterPluginActivation, nextEnabled: boolean) => {
    setTogglingPluginId(item.plugin_id);
    try {
      await api.upsertSemesterPluginActivation(semesterId, item.plugin_id, {
        is_enabled: nextEnabled,
      });
      await invalidateAll();
    } finally {
      setTogglingPluginId(null);
    }
  };

  const handleToggleAllEnabled = async (nextEnabled: boolean) => {
    const targetPluginIds = bulkToggleCandidates
      .filter((plugin) => {
        const localDisableReason = isLocalDisableReason(plugin);
        const blockedByPrerequisite = plugin.available === false && !localDisableReason;
        return nextEnabled
          ? !plugin.is_enabled && !blockedByPrerequisite
          : plugin.is_enabled;
      })
      .map((plugin) => plugin.plugin_id);

    if (targetPluginIds.length === 0) {
      return;
    }

    setTogglingPluginId("__bulk__");
    try {
      await api.bulkUpdateSemesterPluginActivations(semesterId, {
        plugin_ids: targetPluginIds,
        is_enabled: nextEnabled,
      });
      await invalidateAll();
    } finally {
      setTogglingPluginId(null);
    }
  };

  return (
    <SettingsSection
      title="Semester Plugins"
      description="Review every Program-enabled plugin for this Semester. Plugins not yet imported into the Semester stay visible here as Off until you enable them."
      contentClassName="space-y-5"
    >
      <DataTable
        title="Semester Plugins"
        description="Review every Program-enabled plugin for this Semester. This panel only supports enable and disable so plugin data is preserved."
        items={installedPlugins}
        emptyMessage="No plugins have been added to this Semester yet."
        minWidthClassName="min-w-[40rem] sm:min-w-[48rem]"
        renderHeader={() => (
          <TableRow>
            <TableHead>Plugin</TableHead>
            <TableHead>Author</TableHead>
            <TableHead className="w-[180px] text-right">
              <div className="ml-auto flex w-full max-w-[172px] items-center justify-end gap-3">
                <span>Enabled</span>
                <Switch
                  checked={areAllBulkToggleCandidatesEnabled}
                  aria-label="Toggle all editable Semester plugins"
                  disabled={togglingPluginId !== null || (!canEnableAll && !canDisableAll)}
                  onCheckedChange={(checked) => {
                    void handleToggleAllEnabled(Boolean(checked));
                  }}
                />
              </div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        )}
        renderRow={(plugin) => {
          const localDisableReason = isLocalDisableReason(plugin);
          const blockedByPrerequisite = plugin.available === false && !localDisableReason;
          const switchDisabled = plugin.locked || togglingPluginId === plugin.plugin_id || (!plugin.is_enabled && blockedByPrerequisite);
          const pluginIcon = getPluginIconById(plugin.plugin_id);

          return (
            <TableRow key={plugin.plugin_id}>
              <TableCell className="py-3">
                <div className="flex items-center gap-3">
                  <IconCircle icon={pluginIcon} label={plugin.display_name} size={30} className="bg-muted text-foreground" />
                  <div className="text-sm font-medium">{plugin.display_name}</div>
                </div>
              </TableCell>
              <TableCell className="py-3">
                <span className="text-sm text-muted-foreground">{plugin.author}</span>
              </TableCell>
              <TableCell className="py-3 text-right">
                <div className="ml-auto flex items-center justify-end gap-3">
                  <span className="text-xs text-muted-foreground">{plugin.is_enabled ? "On" : "Off"}</span>
                  <Switch
                    checked={plugin.is_enabled}
                    aria-label={`${plugin.display_name} enabled`}
                    onCheckedChange={(checked) => {
                      void handleToggleEnabled(plugin, Boolean(checked));
                    }}
                    disabled={switchDisabled}
                  />
                </div>
              </TableCell>
              <TableCell className="py-3 text-right">
                <DataTableActionMenu triggerLabel={`Open actions for ${plugin.display_name}`}>
                  <DropdownMenuItem onClick={() => setDetailPlugin(plugin)}>
                    <Info className="h-4 w-4" />
                    Plugin Info
                  </DropdownMenuItem>
                </DataTableActionMenu>
              </TableCell>
            </TableRow>
          );
        }}
      />

      <ResponsiveDialogDrawer
        open={detailPlugin !== null}
        onOpenChange={(open) => !open && setDetailPlugin(null)}
        title="Plugin Information"
        desktopContentClassName="gap-0 overflow-hidden border-border/70 p-0 sm:max-w-3xl h-[640px] flex flex-col"
        mobileContentClassName="gap-0 overflow-hidden border-border/70 p-0 h-[85vh] max-h-[85vh] flex flex-col"
        desktopHeaderClassName="border-b border-border/70 px-6 pt-6 pb-4 flex-none"
        mobileHeaderClassName="border-b border-border/70 px-6 pt-6 pb-4 flex-none text-left"
      >
        {detailPlugin ? (
          <ScrollArea className="min-h-0 flex-1 px-6 py-5">
            <PluginDetailsView
              pluginId={detailPlugin.plugin_id}
              displayName={detailPlugin.display_name}
              description={detailPlugin.description}
              longDescription={detailPlugin.long_description}
              author={detailPlugin.author}
              version={detailPlugin.version}
              icon={getPluginIconById(detailPlugin.plugin_id)}
              disabledReason={detailPlugin.availability_reason}
              contexts={detailPlugin.capabilities.contexts}
              availableTabTypes={detailPlugin.capabilities.available_tab_types}
              availableWidgetTypes={detailPlugin.capabilities.available_widget_types}
            />
          </ScrollArea>
        ) : null}
      </ResponsiveDialogDrawer>
    </SettingsSection>
  );
};
