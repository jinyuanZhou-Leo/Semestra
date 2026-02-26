// input:  [settings section copy/action props and wrapped content node]
// output: [`SettingsSection` component]
// pos:    [Reusable card-based section wrapper for settings screens]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  center?: boolean;
  className?: string;
  contentClassName?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  headerAction,
  center = false,
  className,
  contentClassName,
}) => {
  return (
    <section className={cn("grid gap-x-12 gap-y-6 md:grid-cols-3 lg:grid-cols-4 py-2", className)}>
      {(title || description || headerAction) && (
        <div className="md:col-span-1 lg:col-span-1 space-y-4">
          <div className="space-y-1.5 pt-1.5">
            {title && (
              <h3 className="text-base font-semibold leading-tight sm:text-lg">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={cn("md:col-span-2 lg:col-span-3", !(title || description || headerAction) && "md:col-start-2 lg:col-start-2")}>
        <Card className="shadow-none">
          <CardContent className={cn("p-6", center && "flex justify-center", contentClassName)}>
            {children}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
