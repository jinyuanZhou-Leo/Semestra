// input:  [plugin id, optional plugin display metadata, plugin settings component, stable scope contracts, manifest icon helpers, and workspace refresh callback]
// output: [`PluginSettingsSectionRenderer` component that injects scope-aware plugin settings section props and a consistent plugin header]
// pos:    [Bridge component between page-level plugin settings registration and settings-page rendering, with a shared plugin identity header for Program, Semester, and Course settings surfaces]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import type { ReactNode } from 'react';

import { IconCircle } from '@/components/IconCircle';
import type { PluginSettingsScope, PluginSettingsSectionProps } from '@/services/pluginSettingsRegistry';

interface PluginSettingsSectionRendererProps {
  pluginId: string;
  pluginIcon?: ReactNode;
  pluginDisplayName?: string;
  pluginDescription?: string;
  showPluginHeader?: boolean;
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
  pluginIcon,
  pluginDisplayName,
  pluginDescription,
  showPluginHeader = true,
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
        pluginId={pluginId}
        scope={scope}
        onRefresh={onRefresh}
      />
    </div>
  );
};
