// input:  [Program id, program plugin management APIs, app-side Program resource hooks/cache helpers, plugin-manifest icon helpers, shared settings-section primitives, the shared data-table shell, the responsive plugin marketplace surface, shared plugin details, and shared row-actions dropdown helpers]
// output: [`ProgramPluginManagementPanel` component]
// pos:    [Program settings surface for plugin-level install, enable, disable, delete, and reusable plugin-info flows using the shared data-table pattern plus an explicit plugin-table minimum width and a shadcn-style row-actions dropdown, with downstream Semester/Course cache invalidation after Program plugin changes]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Info , PackagePlus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";

import {
  invalidateProgramPluginGovernanceQueries,
  useProgramPluginCatalogQuery,
} from "@/data/resources";
import { getPluginIconById } from "@/plugin-system";

import api, { type ProgramPluginInstallation } from "../services/api";
import { DataTable, DataTableActionMenu } from "./DataTable";
import { IconCircle } from "./IconCircle";
import { PluginDetailsView } from "./PluginDetailsView";
import { PluginMarketplaceDialog } from "./PluginMarketplaceDialog";
import { ResponsiveDialogDrawer } from "./ResponsiveDialogDrawer";
import { SettingsSection } from "./SettingsSection";

interface ProgramPluginManagementPanelProps {
  programId: string;
  onChanged?: () => Promise<void> | void;
}

const isInstalled = (plugin: ProgramPluginInstallation) => plugin.installed !== false;
const isMarketplaceInstallable = (plugin: ProgramPluginInstallation) => plugin.available !== false || Boolean(plugin.is_enabled);
const canInstallFromMarketplace = (plugin: ProgramPluginInstallation) => !isInstalled(plugin) && isMarketplaceInstallable(plugin);
const isLocalDisableReason = (plugin: ProgramPluginInstallation) => plugin.availability_reason === "Disabled at Program level.";
export const ProgramPluginManagementPanel: React.FC<ProgramPluginManagementPanelProps> = ({
  programId,
  onChanged,
}) => {
  const queryClient = useQueryClient();
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [detailPlugin, setDetailPlugin] = useState<ProgramPluginInstallation | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProgramPluginInstallation | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null);
  const [deletingPluginId, setDeletingPluginId] = useState<string | null>(null);

  const pluginCatalogQuery = useProgramPluginCatalogQuery(programId);

  const installedPlugins = useMemo(
    () => (pluginCatalogQuery.data ?? []).filter(isInstalled),
    [pluginCatalogQuery.data],
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
  const marketplaceDialogItems = useMemo(
    () => (pluginCatalogQuery.data ?? []).map((plugin) => ({
      pluginId: plugin.plugin_id,
      displayName: plugin.display_name,
      description: plugin.description,
      longDescription: plugin.long_description,
      author: plugin.author,
      version: plugin.version,
      contexts: plugin.capabilities.contexts,
      availableTabTypes: plugin.capabilities.available_tab_types,
      availableWidgetTypes: plugin.capabilities.available_widget_types,
      icon: getPluginIconById(plugin.plugin_id),
      disabled: !canInstallFromMarketplace(plugin),
      disabledReason: plugin.available === false
        ? (plugin.availability_reason ?? "This plugin is currently unavailable.")
        : null,
      label: isInstalled(plugin) ? "Installed" : "Install",
    })),
    [pluginCatalogQuery.data],
  );

  const invalidateAll = async () => {
    await invalidateProgramPluginGovernanceQueries(queryClient, programId);
    await onChanged?.();
  };

  const handleInstall = async (item: ProgramPluginInstallation) => {
    if (!canInstallFromMarketplace(item)) return;
    setInstallingPluginId(item.plugin_id);
    try {
      await api.upsertProgramPluginInstallation(programId, item.plugin_id, {
        is_enabled: true,
      });
      setIsMarketplaceOpen(false);
      await invalidateAll();
    } finally {
      setInstallingPluginId(null);
    }
  };

  const handleToggleEnabled = async (item: ProgramPluginInstallation, nextEnabled: boolean) => {
    setTogglingPluginId(item.plugin_id);
    try {
      await api.upsertProgramPluginInstallation(programId, item.plugin_id, {
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
      await api.bulkUpdateProgramPluginInstallations(programId, {
        plugin_ids: targetPluginIds,
        is_enabled: nextEnabled,
      });
      await invalidateAll();
    } finally {
      setTogglingPluginId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingPluginId(pendingDelete.plugin_id);
    try {
      await api.deleteProgramPluginInstallation(programId, pendingDelete.plugin_id);
      setPendingDelete(null);
      await invalidateAll();
    } finally {
      setDeletingPluginId(null);
    }
  };

  return (
    <SettingsSection
      title="Program Plugins"
      description="Install workspace plugins, toggle whether a Program keeps them active, and remove plugins only when you want their data deleted."
      contentClassName="space-y-5"
    >
      <DataTable
        title="Program Plugins"
        description="Install workspace plugins, toggle whether a Program keeps them active, and remove plugins only when you want their data deleted."
        items={installedPlugins}
        isLoading={pluginCatalogQuery.isLoading}
        emptyMessage="No plugins are installed for this Program yet."
        minWidthClassName="min-w-[40rem] sm:min-w-[48rem]"
        actionButton={(
          <Button type="button" className="shrink-0 self-start" onClick={() => setIsMarketplaceOpen(true)}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Install plugin
          </Button>
        )}
        renderHeader={() => (
          <TableRow>
            <TableHead>Plugin</TableHead>
            <TableHead>Author</TableHead>
            <TableHead className="w-[180px] text-right">
              <div className="ml-auto flex w-full max-w-[172px] items-center justify-end gap-3">
                <span>Enabled</span>
                <Switch
                  checked={areAllBulkToggleCandidatesEnabled}
                  aria-label="Toggle all editable Program plugins"
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
          const locked = Boolean(plugin.locked);
          const localDisableReason = isLocalDisableReason(plugin);
          const blockedByPrerequisite = plugin.available === false && !localDisableReason;
          const switchDisabled = locked || togglingPluginId === plugin.plugin_id || (!plugin.is_enabled && blockedByPrerequisite);
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
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={locked || deletingPluginId === plugin.plugin_id}
                    onClick={() => setPendingDelete(plugin)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DataTableActionMenu>
              </TableCell>
            </TableRow>
          );
        }}
      />

      <PluginMarketplaceDialog
        open={isMarketplaceOpen}
        onOpenChange={setIsMarketplaceOpen}
        title="Install plugin"
        description="Search the workspace catalog and install a plugin into this Program."
        searchPlaceholder="Search plugins by name, author, or description..."
        emptyLabel="No workspace plugins are available for this Program yet."
        noResultsLabel="No plugins match your search."
        items={marketplaceDialogItems}
        pendingPluginId={installingPluginId}
        onSelect={(pluginId) => {
          const plugin = (pluginCatalogQuery.data ?? []).find((entry) => entry.plugin_id === pluginId);
          if (!plugin) return;
          void handleInstall(plugin);
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

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plugin?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Delete "${pendingDelete.display_name}" from this Program? This removes the saved plugin record and its data.`
                : "Delete this plugin from the Program?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPluginId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deletingPluginId !== null}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
};
