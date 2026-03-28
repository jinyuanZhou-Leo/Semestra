// input:  [plugin id, optional plugin display metadata, plugin settings component, resolved runtime settings seed, shared settings hook, manifest icon helpers, and workspace refresh callback]
// output: [`PluginSettingsSectionRenderer` component that injects framework-managed plugin-global settings props and a consistent plugin header]
// pos:    [Bridge component between page-level plugin settings registration and framework-managed shared settings persistence seeded from runtime-governed config, with a shared plugin identity header for Program, Semester, and Course settings surfaces]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import type { ReactNode } from 'react';

import { IconCircle } from '@/components/IconCircle';
import { usePluginSharedSettings } from '@/hooks/usePluginSharedSettings';
import type { PluginSettingsProps } from '@/services/pluginSettingsRegistry';

interface PluginSettingsSectionRendererProps {
  pluginId: string;
  pluginIcon?: ReactNode;
  pluginDisplayName?: string;
  pluginDescription?: string;
  showPluginHeader?: boolean;
  component: React.FC<PluginSettingsProps>;
  programId?: string;
  semesterId?: string;
  courseId?: string;
  initialSettings?: Record<string, unknown>;
  onRefresh: () => void;
}

const formatPluginLabel = (pluginId: string) => pluginId
  .split('-')
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(' ');

export const PluginSettingsSectionRenderer: React.FC<PluginSettingsSectionRendererProps> = ({
  pluginId,
  pluginIcon,
  pluginDisplayName,
  pluginDescription,
  showPluginHeader = true,
  component: Component,
  programId,
  semesterId,
  courseId,
  initialSettings,
  onRefresh,
}) => {
  const { settings, updateSettings, saveState, hasPendingChanges, isLoading } = usePluginSharedSettings({
    pluginId,
    programId,
    semesterId,
    courseId,
    initialSettings,
  });
  const pluginTitle = pluginDisplayName || formatPluginLabel(pluginId);

  return (
    <div className="space-y-3">
      {showPluginHeader ? (
        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3">
          <IconCircle icon={pluginIcon} label={pluginTitle} size={30} className="bg-muted text-foreground" />
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium text-foreground">{pluginTitle}</div>
            {pluginDescription ? (
              <p className="text-xs leading-5 text-muted-foreground">{pluginDescription}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <Component
        settings={settings}
        updateSettings={updateSettings}
        saveState={saveState}
        hasPendingChanges={hasPendingChanges}
        isLoading={isLoading}
        programId={programId}
        semesterId={semesterId}
        courseId={courseId}
        onRefresh={onRefresh}
      />
    </div>
  );
};
