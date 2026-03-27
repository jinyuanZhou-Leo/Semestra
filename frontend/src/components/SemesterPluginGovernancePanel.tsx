// input:  [Semester plugin activations, Semester id, plugin-manifest icon helpers, refresh callback, shared settings-section primitives, and the shared CRUD table shell]
// output: [`SemesterPluginGovernancePanel` component]
// pos:    [Semester settings surface for plugin-level enable/disable and protected delete rules using the shared CRUD table pattern]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

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

import api, { type SemesterPluginActivation } from "../services/api";
import { CrudPanel } from "./CrudPanel";
import { IconCircle } from "./IconCircle";
import { SettingsSection } from "./SettingsSection";

interface SemesterPluginGovernancePanelProps {
  semesterId: string;
  pluginActivations: SemesterPluginActivation[];
  onChanged?: () => Promise<void> | void;
}

const isLocalDisableReason = (plugin: SemesterPluginActivation) => plugin.availability_reason === "Disabled for this Semester.";
export const SemesterPluginGovernancePanel: React.FC<SemesterPluginGovernancePanelProps> = ({
  semesterId,
  pluginActivations,
  onChanged,
}) => {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<SemesterPluginActivation | null>(null);
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null);
  const [deletingPluginId, setDeletingPluginId] = useState<string | null>(null);

  const installedPlugins = useMemo(
    () => pluginActivations,
    [pluginActivations],
  );

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.semesters.detail(semesterId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.semesters.pluginActivations(semesterId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.semesters.pluginSettings(semesterId) }),
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

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingPluginId(pendingDelete.plugin_id);
    try {
      await api.deleteSemesterPluginActivation(semesterId, pendingDelete.plugin_id);
      setPendingDelete(null);
      await invalidateAll();
    } finally {
      setDeletingPluginId(null);
    }
  };

  return (
    <SettingsSection
      title="Semester Plugins"
      description="Enable or disable the Program-governed plugins already attached to this Semester. Built-in workspace tabs cannot be deleted here."
      contentClassName="space-y-5"
    >
      <CrudPanel
        title="Semester Plugins"
        description="Enable or disable the Program-governed plugins already attached to this Semester. Built-in workspace tabs cannot be deleted here."
        showHeader={false}
        items={installedPlugins}
        emptyMessage="No plugins have been added to this Semester yet."
        minWidthClassName="min-w-[760px] xl:min-w-[840px]"
        renderHeader={() => (
          <TableRow>
            <TableHead className="min-w-[220px]">Plugin</TableHead>
            <TableHead className="min-w-[120px]">Author</TableHead>
            <TableHead className="w-[140px] text-right">Enabled</TableHead>
            <TableHead className="w-[92px] text-right">Actions</TableHead>
          </TableRow>
        )}
        renderRow={(plugin) => {
          const localDisableReason = isLocalDisableReason(plugin);
          const blockedByPrerequisite = plugin.available === false && !localDisableReason;
          const switchDisabled = togglingPluginId === plugin.plugin_id || (!plugin.is_enabled && blockedByPrerequisite);
          const pluginIcon = getPluginIconById(plugin.plugin_id);
          const deleteDisabled = Boolean(plugin.locked) || deletingPluginId === plugin.plugin_id;

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
                {!plugin.locked ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setPendingDelete(plugin)}
                    disabled={deleteDisabled}
                    aria-label={`Delete ${plugin.display_name}`}
                    title={`Delete ${plugin.display_name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          );
        }}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plugin?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Delete "${pendingDelete.display_name}" from this Semester? This removes the saved plugin record and its Semester data.`
                : "Delete this plugin from the Semester?"}
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
