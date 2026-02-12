import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
    <section className={cn("space-y-4", className)}>
      <Card className="shadow-none">
        {(title || description || headerAction) && (
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                {title && (
                  <CardTitle className="text-base font-semibold leading-6 sm:text-lg">
                    {title}
                  </CardTitle>
                )}
                {description && (
                  <CardDescription className="text-sm">
                    {description}
                  </CardDescription>
                )}
              </div>
              {headerAction && <div>{headerAction}</div>}
            </div>
          </CardHeader>
        )}
        <CardContent className={contentClassName}>
          <div className={cn(center && "flex justify-center")}>{children}</div>
        </CardContent>
      </Card>
    </section>
  );
};
