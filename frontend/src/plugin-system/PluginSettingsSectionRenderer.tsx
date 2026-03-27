// input:  [plugin id, plugin settings component, resolved runtime settings seed, shared settings hook, and workspace refresh callback]
// output: [`PluginSettingsSectionRenderer` component that injects framework-managed plugin-global settings props]
// pos:    [Bridge component between page-level plugin settings registration and framework-managed shared settings persistence seeded from runtime-governed config]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';

import { usePluginSharedSettings } from '@/hooks/usePluginSharedSettings';
import type { PluginSettingsProps } from '@/services/pluginSettingsRegistry';

interface PluginSettingsSectionRendererProps {
  pluginId: string;
  component: React.FC<PluginSettingsProps>;
  semesterId?: string;
  courseId?: string;
  initialSettings?: Record<string, unknown>;
  onRefresh: () => void;
}

export const PluginSettingsSectionRenderer: React.FC<PluginSettingsSectionRendererProps> = ({
  pluginId,
  component: Component,
  semesterId,
  courseId,
  initialSettings,
  onRefresh,
}) => {
  const { settings, updateSettings, saveState, hasPendingChanges, isLoading } = usePluginSharedSettings({
    pluginId,
    semesterId,
    courseId,
    initialSettings,
  });

  return (
    <Component
      settings={settings}
      updateSettings={updateSettings}
      saveState={saveState}
      hasPendingChanges={hasPendingChanges}
      isLoading={isLoading}
      semesterId={semesterId}
      courseId={courseId}
      onRefresh={onRefresh}
    />
  );
};
