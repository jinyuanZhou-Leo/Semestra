// input:  [plugin settings registry, settings section renderer, and plugin activation metadata]
// output: [`PluginSettingsSectionsGroup` shared component that renders filtered plugin settings sections]
// pos:    [Shared component that captures the recurring plugin settings filter/header/render logic previously
//          duplicated across ProgramSettingsPage, SemesterHomepage, and CourseHomepage]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useMemo } from 'react';
import type { PluginSettingsContext } from '@/services/pluginSettingsRegistry';

import { PluginSettingsSectionRenderer } from './PluginSettingsSectionRenderer';
import { usePluginSettingsRegistry } from './settings-sections';

export interface PluginActivationMeta {
  plugin_id: string;
  display_name: string;
  description?: string;
}

interface PluginSettingsSectionsGroupProps {
  context: PluginSettingsContext;
  enabledPluginIds: Set<string>;
  pluginActivations: PluginActivationMeta[];
  programId?: string;
  semesterId?: string;
  courseId?: string;
  onRefresh: () => void;
}

export const PluginSettingsSectionsGroup: React.FC<PluginSettingsSectionsGroupProps> = ({
  context,
  enabledPluginIds,
  pluginActivations,
  programId,
  semesterId,
  courseId,
  onRefresh,
}) => {
  const allDefinitions = usePluginSettingsRegistry(context);

  const enabledDefinitions = useMemo(
    () => allDefinitions.filter((definition) => enabledPluginIds.has(definition.pluginId)),
    [allDefinitions, enabledPluginIds],
  );

  const pluginMetadataById = useMemo(() => {
    const map = new Map<string, { displayName: string; description?: string }>();
    for (const activation of pluginActivations) {
      if (enabledPluginIds.has(activation.plugin_id)) {
        map.set(activation.plugin_id, {
          displayName: activation.display_name,
          description: activation.description,
        });
      }
    }
    return map;
  }, [enabledPluginIds, pluginActivations]);

  if (enabledDefinitions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {enabledDefinitions.map((definition) => (
        <React.Fragment key={`${definition.pluginId}:${definition.id}`}>
          <PluginSettingsSectionRenderer
            pluginId={definition.pluginId}
            pluginDisplayName={pluginMetadataById.get(definition.pluginId)?.displayName}
            component={definition.component}
            programId={programId}
            semesterId={semesterId}
            courseId={courseId}
            onRefresh={onRefresh}
          />
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * Hook to check whether any plugin settings sections exist for the given context and enabled plugins.
 * Useful for conditionally showing/hiding the settings group wrapper.
 */
export const useHasPluginSettingsSections = (
  context: PluginSettingsContext,
  enabledPluginIds: Set<string>,
): boolean => {
  const allDefinitions = usePluginSettingsRegistry(context);
  return useMemo(
    () => allDefinitions.some((definition) => enabledPluginIds.has(definition.pluginId)),
    [allDefinitions, enabledPluginIds],
  );
};
