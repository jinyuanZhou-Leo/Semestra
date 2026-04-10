import React from "react";

import { PluginSetupStepRenderer } from "../../components/PluginSetupRenderers";
import type { PluginSystemSemesterSetupPlugin } from "../../services/api";
import type { PluginSetupDraftMap } from "./types";
import type { PluginSetupValidationIssue } from "@/plugin-system";
import { isPluginSetupStepId, getPluginIdFromStepId } from "./utils";
import type { StepId } from "./types";

interface WizardPluginSetupStepProps {
  setupPlugins: PluginSystemSemesterSetupPlugin[];
  activeStep: StepId;
  pluginSetupDrafts: PluginSetupDraftMap;
  pluginSetupValidationErrors: Record<string, PluginSetupValidationIssue[]>;
  semesterId: string | undefined;
  programId: string | undefined;
  onValueChange: (plugin: PluginSystemSemesterSetupPlugin, fieldPath: string, value: unknown) => void;
}

export const WizardPluginSetupStep: React.FC<WizardPluginSetupStepProps> = ({
  setupPlugins,
  activeStep,
  pluginSetupDrafts,
  pluginSetupValidationErrors,
  semesterId,
  programId,
  onValueChange,
}) => {
  if (setupPlugins.length === 0 || !isPluginSetupStepId(activeStep)) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
        No enabled plugins require setup.
      </div>
    );
  }

  const activePluginId = getPluginIdFromStepId(activeStep);

  return (
    <div className="space-y-6">
      {setupPlugins
        .filter((plugin) => plugin.plugin_id === activePluginId)
        .map((plugin) => (
          <section key={plugin.plugin_id}>
            <PluginSetupStepRenderer
              plugin={plugin}
              values={pluginSetupDrafts[plugin.plugin_id] ?? plugin.setup_values}
              localErrors={pluginSetupValidationErrors[plugin.plugin_id] ?? []}
              semesterId={semesterId}
              programId={programId}
              onValueChange={(fieldPath, value) => onValueChange(plugin, fieldPath, value)}
            />
          </section>
        ))}
    </div>
  );
};
