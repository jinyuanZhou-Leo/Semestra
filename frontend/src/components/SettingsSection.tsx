import React from "react";
import { Card } from "@/components/ui/card";
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
  const hasHeader = Boolean(title || description || headerAction);

  return (
    <section>
      <Card>
        <div
          className={cn(
            "grid gap-6 p-6",
            hasHeader && "md:grid-cols-[220px_minmax(0,1fr)]",
            center && "items-center"
          )}
        >
          {hasHeader && (
            <div className="space-y-2">
              {title && (
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {title}
                </div>
              )}
              {description && (
                <p className="text-sm text-foreground/90">{description}</p>
              )}
              {headerAction && <div className="pt-2">{headerAction}</div>}
            </div>
          )}
          <div className="min-w-0">{children}</div>
        </div>
      </Card>
    </section>
  );
};
