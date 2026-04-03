// input:  [scope-aware plugin settings section props injected by the host renderer]
// output: [plugin settings panel context provider plus hook for bound settings-field helpers]
// pos:    [small runtime context that lets plugin settings panels access the current plugin id, scope, and refresh callback without prop drilling]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from "react";

import type { PluginSettingsScope } from "@/services/pluginSettingsRegistry";

export interface PluginSettingsPanelContextValue {
  pluginId: string;
  scope: PluginSettingsScope;
  onRefresh: () => void;
}

const PluginSettingsPanelContext = React.createContext<PluginSettingsPanelContextValue | null>(null);

export const PluginSettingsPanelProvider: React.FC<React.PropsWithChildren<PluginSettingsPanelContextValue>> = ({
  children,
  ...value
}) => (
  <PluginSettingsPanelContext.Provider value={value}>
    {children}
  </PluginSettingsPanelContext.Provider>
);

export const usePluginSettingsPanelContext = (): PluginSettingsPanelContextValue => {
  const context = React.useContext(PluginSettingsPanelContext);
  if (!context) {
    throw new Error("usePluginSettingsPanelContext must be used inside PluginSettingsPanelProvider.");
  }
  return context;
};

export const usePluginSettingsContext = usePluginSettingsPanelContext;
