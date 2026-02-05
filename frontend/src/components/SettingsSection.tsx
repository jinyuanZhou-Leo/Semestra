import React from "react";

import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  center?: boolean;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  headerAction,
  center = false,
}) => {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          {title && (
            <h3 className="text-lg font-medium leading-6 decoration-foreground">
              {title}
            </h3>
          )}
          {headerAction && <div>{headerAction}</div>}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className={cn(center && "flex justify-center")}>{children}</div>
    </section>
  );
};
