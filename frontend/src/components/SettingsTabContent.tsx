import React from "react";
import { Separator } from "@/components/ui/separator";

interface SettingsTabContentProps {
  content: React.ReactNode;
  extraSections?: React.ReactNode;
}

export const SettingsTabContent: React.FC<SettingsTabContentProps> = ({
  content,
  extraSections,
}) => {
  return (
    <div className="space-y-10 py-4">
      {content}
      {extraSections && (
        <div role="region" aria-label="Plugin Settings" className="space-y-6">
          <Separator />
          {extraSections}
        </div>
      )}
    </div>
  );
};
