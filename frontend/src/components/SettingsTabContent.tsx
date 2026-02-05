import React from "react";
import { SettingsForm } from "./SettingsForm";
import { SettingsSection } from "./SettingsSection";
import { Separator } from "@/components/ui/separator";

interface SettingsTabContentProps {
  initialName: string;
  initialSettings?: any;
  onSave: (data: any) => Promise<void>;
  type: "program" | "semester" | "course";
  extraSections?: React.ReactNode;
}

export const SettingsTabContent: React.FC<SettingsTabContentProps> = ({
  initialName,
  initialSettings,
  onSave,
  type,
  extraSections,
}) => {


  return (
    <div className="space-y-10 py-4">


        <SettingsSection
          title="General"
        description={`Update the name and key settings.`}
        >
          <SettingsForm
            initialName={initialName}
            initialSettings={initialSettings}
            onSave={onSave}
            type={type}
            submitLabel="Save Settings"
          />
      </SettingsSection>
      {extraSections && (
        <div role="region" aria-label="Plugin Settings" className="space-y-6">
          <Separator />
          {extraSections}
        </div>
      )}
    </div>
  );
};
