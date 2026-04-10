import React from "react";

import { Switch } from "@/components/ui/switch";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { DataTable } from "../../components/DataTable";
import { IconCircle } from "../../components/IconCircle";
import { getPluginIconById } from "@/plugin-system";
import type { ProgramPluginInstallation } from "../../services/api";

interface WizardPluginsStepProps {
  pluginCatalog: ProgramPluginInstallation[];
  enabledPluginIds: Set<string>;
  /** Pre-filtered unlocked+available plugins — eliminates repeated scans inside the render. */
  toggleableAvailablePlugins: ProgramPluginInstallation[];
  isUpdatingPluginSelection: boolean;
  onTogglePlugin: (plugin: ProgramPluginInstallation, checked: boolean) => Promise<void>;
  onToggleAll: (checked: boolean) => Promise<void>;
}

export const WizardPluginsStep: React.FC<WizardPluginsStepProps> = ({
  pluginCatalog,
  enabledPluginIds,
  toggleableAvailablePlugins,
  isUpdatingPluginSelection,
  onTogglePlugin,
  onToggleAll,
}) => (
  <DataTable
    title="Plugins"
    description="Enable or disable Program plugins for this Semester."
    showHeader={false}
    rootClassName="flex h-full min-h-0 flex-col"
    items={pluginCatalog}
    emptyMessage="This Program does not have any installed plugins available for Semester configuration yet."
    minWidthClassName="min-w-[36rem] sm:min-w-[44rem] xl:min-w-[52rem]"
    shellClassName="min-h-[20rem] min-w-0 flex-1 overflow-y-auto"
    emptyRowClassName="h-[17rem] align-middle sm:h-full"
    tableClassName="h-full w-full min-w-full table-auto sm:w-max sm:min-w-full [&_td]:max-w-[16rem] sm:[&_td]:max-w-[22rem] [&_td]:whitespace-normal sm:[&_td]:whitespace-nowrap [&_th]:max-w-[16rem] sm:[&_th]:max-w-[22rem] [&_th]:whitespace-normal sm:[&_th]:whitespace-nowrap"
    renderHeader={() => (
      <TableRow>
        <TableHead className="min-w-[220px]">Plugin</TableHead>
        <TableHead className="min-w-[120px]">Author</TableHead>
        <TableHead className="w-[180px] text-right">
          <div className="ml-auto flex w-full max-w-[172px] items-center justify-end gap-3">
            <span>Enabled</span>
            <Switch
              checked={toggleableAvailablePlugins.length > 0 && toggleableAvailablePlugins.every((plugin) => enabledPluginIds.has(plugin.plugin_id))}
              aria-label="Toggle all editable plugins"
              disabled={isUpdatingPluginSelection || (toggleableAvailablePlugins.length === 0 && !pluginCatalog.some((plugin) => !plugin.locked && enabledPluginIds.has(plugin.plugin_id)))}
              onCheckedChange={(checked) => {
                void onToggleAll(Boolean(checked));
              }}
            />
          </div>
        </TableHead>
      </TableRow>
    )}
    renderRow={(plugin) => {
      const pluginIcon = getPluginIconById(plugin.plugin_id);
      const isEnabled = enabledPluginIds.has(plugin.plugin_id);
      const switchDisabled = (!plugin.available && !isEnabled) || plugin.locked;

      return (
        <TableRow key={plugin.plugin_id} className="align-middle">
          <TableCell className="py-3 align-middle">
            <div className="flex items-start gap-3">
              <IconCircle icon={pluginIcon} label={plugin.display_name} size={30} className="bg-muted text-foreground" />
              <div className="min-w-0 space-y-1">
                <div className="font-medium text-foreground">{plugin.display_name}</div>
                <p className="text-sm text-muted-foreground">{plugin.description}</p>
                {plugin.locked ? <p className="text-xs text-muted-foreground">Required by the Program.</p> : null}
                {!plugin.available ? <p className="text-xs text-amber-700 dark:text-amber-300">{plugin.availability_reason ?? "Not available."}</p> : null}
              </div>
            </div>
          </TableCell>
          <TableCell className="py-3 align-middle">
            <span className="text-sm text-muted-foreground">{plugin.author}</span>
          </TableCell>
          <TableCell className="py-3 text-right align-middle">
            <div className="ml-auto flex w-full max-w-[132px] items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">{isEnabled ? "On" : "Off"}</span>
              <Switch
                checked={isEnabled}
                aria-label={`${plugin.display_name} enabled`}
                onCheckedChange={(checked) => {
                  void onTogglePlugin(plugin, Boolean(checked));
                }}
                disabled={switchDisabled}
              />
            </div>
          </TableCell>
        </TableRow>
      );
    }}
  />
);
