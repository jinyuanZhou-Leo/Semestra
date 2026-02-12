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
