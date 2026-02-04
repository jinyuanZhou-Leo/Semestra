import React from "react";
import { SettingsForm } from "./SettingsForm";
import { SettingsSection } from "./SettingsSection";
import { Separator } from "@/components/ui/separator";

interface SettingsTabContentProps {
  title?: string | null;
  initialName: string;
  initialSettings?: any;
  onSave: (data: any) => Promise<void>;
  type: "program" | "semester" | "course";
  extraSections?: React.ReactNode;
}

export const SettingsTabContent: React.FC<SettingsTabContentProps> = ({
  title,
  initialName,
  initialSettings,
  onSave,
  type,
  extraSections,
}) => {
  const ariaTitle =
    title ??
    (type === "semester"
      ? "Semester Settings"
      : type === "course"
        ? "Course Settings"
        : "Program Settings");
  const contextLabel =
    type === "semester"
      ? "Semester Setting"
      : type === "course"
        ? "Course Setting"
        : "Program Setting";

  return (
    <div className="space-y-10 py-4">
      <div role="region" aria-label={ariaTitle} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {contextLabel}
            </p>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
          </div>
        </div>

        <SettingsSection
          title="General"
          description={`Update the name and key settings for this ${type}.`}
        >
          <SettingsForm
            initialName={initialName}
            initialSettings={initialSettings}
            onSave={onSave}
            type={type}
            submitLabel="Save Settings"
          />
        </SettingsSection>
      </div>

      {extraSections && (
        <div role="region" aria-label="Plugin Settings" className="space-y-6">
          <Separator />
          {extraSections}
        </div>
      )}
    </div>
  );
};
