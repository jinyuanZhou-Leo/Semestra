// input:  [plugin display metadata, settings component reference, refresh callback and context IDs]
// output: [`PluginSettingsCard` component]
// pos:    [Settings page card wrapper for rendering plugin-level settings modules]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";

import { cn } from "@/lib/utils";

interface PluginSettingsCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const PluginSettingsCard: React.FC<PluginSettingsCardProps> = ({
  title,
  children,
  className,
}) => {
  return (
    <section
      className={cn(
        "mb-4 space-y-3 py-4 last:mb-0",
        className
      )}
    >
      <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
      <div className="space-y-4 [&_[data-slot=card]+[data-slot=card]]:mt-4">
        {children}
      </div>
    </section>
  );
};
