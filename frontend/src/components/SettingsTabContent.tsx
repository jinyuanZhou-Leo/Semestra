import React from "react";
import { Puzzle, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-8 py-4">
      <section role="region" aria-label="General Settings" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="uppercase tracking-wide">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            General
          </Badge>
          <p className="text-sm font-medium text-muted-foreground">
            Core settings for this page.
          </p>
        </div>
        {content}
      </section>
      {extraSections && (
        <section role="region" aria-label="Plugin Settings" className="space-y-4">
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="uppercase tracking-wide">
              <Puzzle className="h-3.5 w-3.5" />
              Plugins
            </Badge>
            <p className="text-sm font-medium text-muted-foreground">
              Additional settings provided by installed plugins.
            </p>
          </div>
          <div>{extraSections}</div>
        </section>
      )}
    </div>
  );
};
