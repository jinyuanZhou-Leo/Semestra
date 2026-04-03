// input:  [plugin id, optional plugin display metadata, plugin settings component, stable scope contracts, and workspace refresh callback]
// output: [`PluginSettingsSectionRenderer` component that injects scope-aware plugin settings section props]
// pos:    [Bridge component between page-level plugin settings registration and settings-page rendering, with plugin ownership metadata flowing into each settings section title rail instead of a separate plugin header block]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';

import { SettingsSectionPluginOwnerProvider } from '@/components/SettingsSection';
import type { PluginSettingsScope, PluginSettingsSectionProps } from '@/services/pluginSettingsRegistry';
import { PluginSettingsPanelProvider } from './pluginSettingsPanelContext';

interface PluginSettingsSectionRendererProps {
  pluginId: string;
  pluginDisplayName?: string;
  component: React.FC<PluginSettingsSectionProps>;
  programId?: string;
  semesterId?: string;
  courseId?: string;
  onRefresh: () => void;
}

const formatPluginLabel = (pluginId: string) => pluginId
  .split('-')
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(' ');

export const PluginSettingsSectionRenderer: React.FC<PluginSettingsSectionRendererProps> = ({
  pluginId,
  pluginDisplayName,
  component: Component,
  programId,
  semesterId,
  courseId,
  onRefresh,
}) => {
  const pluginTitle = pluginDisplayName || formatPluginLabel(pluginId);
  let scope: PluginSettingsScope | null = null;

  if (courseId) {
    scope = {
      kind: 'course',
      courseId,
      semesterId,
      programId,
    };
  } else if (semesterId) {
    scope = {
      kind: 'semester',
      semesterId,
      programId,
    };
  } else if (programId) {
    scope = {
      kind: 'program',
      programId,
    };
  }

  if (!scope) {
    return null;
  }

  return (
    <PluginSettingsPanelProvider
      pluginId={pluginId}
      scope={scope}
      onRefresh={onRefresh}
    >
      <SettingsSectionPluginOwnerProvider value={pluginTitle}>
        <Component
          pluginId={pluginId}
          scope={scope}
          onRefresh={onRefresh}
        />
      </SettingsSectionPluginOwnerProvider>
    </PluginSettingsPanelProvider>
  );
};

