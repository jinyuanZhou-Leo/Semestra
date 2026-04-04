// input:  [scope-aware plugin settings section props injected by the host renderer]
// output: [plugin settings panel context provider plus hook for bound settings-field helpers]
// pos:    [small runtime context that lets plugin settings panels access the current plugin id, scope, and refresh callback without prop drilling]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useMemo } from "react";

import type { PluginSettingsScope } from "@/services/pluginSettingsRegistry";
import { usePluginSettingsEntityQuery, type PluginSettingsEntityQueryResult } from './pluginSettingsEntity';

export interface PluginSettingsPanelContextValue {
  pluginId: string;
  scope: PluginSettingsScope;
  onRefresh: () => void;
  entityQuery: PluginSettingsEntityQueryResult;
}

const PluginSettingsPanelContext = React.createContext<PluginSettingsPanelContextValue | null>(null);

interface PluginSettingsPanelProviderProps {
  children: React.ReactNode;
  pluginId: string;
  scope: PluginSettingsScope;
  onRefresh: () => void;
}

export const PluginSettingsPanelProvider: React.FC<PluginSettingsPanelProviderProps> = ({
  children,
  pluginId,
  scope,
  onRefresh,
}) => {
  const entityQuery = usePluginSettingsEntityQuery(scope);
  const value = useMemo(
    () => ({ pluginId, scope, onRefresh, entityQuery }),
    [entityQuery, pluginId, scope, onRefresh],
  );
  return (
    <PluginSettingsPanelContext.Provider value={value}>
      {children}
    </PluginSettingsPanelContext.Provider>
  );
};

export const usePluginSettingsPanelContext = (): PluginSettingsPanelContextValue => {
  const context = React.useContext(PluginSettingsPanelContext);
  if (!context) {
    throw new Error("usePluginSettingsPanelContext must be used inside PluginSettingsPanelProvider.");
  }
  return context;
};

export const usePluginSettingsContext = usePluginSettingsPanelContext;
