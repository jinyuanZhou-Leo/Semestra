// input:  [Program id, program plugin governance APIs, query cache, plugin-manifest icon helpers, shared settings-section primitives, and the shared CRUD table shell]
// output: [`ProgramPluginGovernancePanel` component]
// pos:    [Program settings surface for plugin-level install, enable, disable, delete, and marketplace search flows using the shared CRUD table pattern]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";

import { getPluginIconById } from "@/plugin-system";
import { queryKeys } from "@/services/queryKeys";

import api, { type ProgramPluginInstallation } from "../services/api";
import { CrudPanel } from "./CrudPanel";
import { IconCircle } from "./IconCircle";
import { PluginMarketplaceDialog } from "./PluginMarketplaceDialog";
import { SettingsSection } from "./SettingsSection";

interface ProgramPluginGovernancePanelProps {
  programId: string;
  onChanged?: () => Promise<void> | void;
}

const isInstalled = (plugin: ProgramPluginInstallation) => plugin.installed !== false;
const isMarketplaceInstallable = (plugin: ProgramPluginInstallation) => plugin.available !== false || Boolean(plugin.is_enabled);
const isLocalDisableReason = (plugin: ProgramPluginInstallation) => plugin.availability_reason === "Disabled at Program level.";
export const ProgramPluginGovernancePanel: React.FC<ProgramPluginGovernancePanelProps> = ({
  programId,
  onChanged,
}) => {
  const queryClient = useQueryClient();
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProgramPluginInstallation | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null);
  const [deletingPluginId, setDeletingPluginId] = useState<string | null>(null);

  const pluginCatalogQuery = useQuery({
    queryKey: queryKeys.programs.pluginCatalog(programId),
    queryFn: () => api.getProgramPluginCatalog(programId),
    staleTime: 30_000,
  });

  const installedPlugins = useMemo(
    () => (pluginCatalogQuery.data ?? []).filter(isInstalled),
    [pluginCatalogQuery.data],
  );
  const marketplacePlugins = useMemo(
    () => (pluginCatalogQuery.data ?? []).filter((plugin) => !isInstalled(plugin)),
    [pluginCatalogQuery.data],
  );
  const marketplaceDialogItems = useMemo(
    () => marketplacePlugins.map((plugin) => ({
      pluginId: plugin.plugin_id,
      displayName: plugin.display_name,
      description: plugin.description,
      author: plugin.author,
      icon: getPluginIconById(plugin.plugin_id),
      disabled: !isMarketplaceInstallable(plugin),
      disabledReason: plugin.available === false ? (plugin.availability_reason ?? "This plugin is currently unavailable.") : null,
      label: "Install",
    })),
    [marketplacePlugins],
  );

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.pluginCatalog(programId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.pluginInstallations(programId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(programId) }),
    ]);
    await onChanged?.();
  };

  const handleInstall = async (item: ProgramPluginInstallation) => {
    if (!isMarketplaceInstallable(item)) return;
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
      <CrudPanel
        title="Program Plugins"
        description="Install workspace plugins, toggle whether a Program keeps them active, and remove plugins only when you want their data deleted."
        showHeader={false}
        items={installedPlugins}
        isLoading={pluginCatalogQuery.isLoading}
        emptyMessage="No plugins are installed for this Program yet."
        minWidthClassName="min-w-[760px] xl:min-w-[840px]"
        actionButton={(
          <Button type="button" className="shrink-0 self-start" onClick={() => setIsMarketplaceOpen(true)}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Install plugin
          </Button>
        )}
        renderHeader={() => (
          <TableRow>
            <TableHead className="min-w-[220px]">Plugin</TableHead>
            <TableHead className="min-w-[120px]">Author</TableHead>
            <TableHead className="w-[140px] text-right">Enabled</TableHead>
            <TableHead className="w-[92px] text-right">Actions</TableHead>
          </TableRow>
        )}
        renderRow={(plugin) => {
          const locked = Boolean(plugin.locked);
          const localDisableReason = isLocalDisableReason(plugin);
          const blockedByPrerequisite = plugin.available === false && !localDisableReason;
          const switchDisabled = locked || togglingPluginId === plugin.plugin_id || (!plugin.is_enabled && blockedByPrerequisite);
          const pluginIcon = getPluginIconById(plugin.plugin_id);

          return (
            <TableRow key={plugin.plugin_id} className="align-top">
              <TableCell className="max-w-[18rem] whitespace-normal break-words py-3">
                <div className="flex items-center gap-3">
                  <IconCircle icon={pluginIcon} label={plugin.display_name} size={30} className="bg-muted text-foreground" />
                  <div className="text-sm font-medium">{plugin.display_name}</div>
                </div>
              </TableCell>
              <TableCell className="py-3 align-top">
                <span className="text-sm text-muted-foreground">{plugin.author}</span>
              </TableCell>
              <TableCell className="py-3 text-right align-top">
                <div className="ml-auto flex w-full max-w-[132px] items-center justify-end gap-3">
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
              <TableCell className="py-3 text-right align-top">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => setPendingDelete(plugin)}
                  disabled={locked || deletingPluginId === plugin.plugin_id}
                  aria-label={`Delete ${plugin.display_name}`}
                  title={`Delete ${plugin.display_name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
        emptyLabel="Every workspace plugin is already installed for this Program."
        items={marketplaceDialogItems}
        pendingPluginId={installingPluginId}
        onSelect={(pluginId) => {
          const plugin = marketplacePlugins.find((entry) => entry.plugin_id === pluginId);
          if (!plugin) return;
          void handleInstall(plugin);
        }}
      />

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
