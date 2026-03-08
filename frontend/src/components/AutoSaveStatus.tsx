// input:  [auto-save state, pending-change flag, optional validation state, and presentational class names]
// output: [`AutoSaveStatus` component]
// pos:    [Shared non-interactive validation-only status line for auto-saving settings forms]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";
import { AlertCircle } from "lucide-react";

import type { AutoSaveState } from "@/hooks/useAutoSave";
import { cn } from "@/lib/utils";

interface AutoSaveStatusProps {
  saveState: AutoSaveState;
  hasPendingChanges: boolean;
  isValid?: boolean;
  className?: string;
}

export const AutoSaveStatus: React.FC<AutoSaveStatusProps> = ({
  isValid = true,
  className,
}) => {
  let icon: React.ReactNode = null;
  let label = "";
  let toneClassName = "text-muted-foreground";

  if (!isValid) {
    icon = <AlertCircle className="size-4" />;
    label = "Fix validation errors to save changes";
    toneClassName = "text-destructive";
  }

  if (!label) {
    return null;
  }

  return (
    <p
      className={cn(
        "flex items-center justify-end gap-2 text-sm",
        toneClassName,
        className
      )}
      aria-live="polite"
    >
      {icon}
      <span>{label}</span>
    </p>
  );
};
