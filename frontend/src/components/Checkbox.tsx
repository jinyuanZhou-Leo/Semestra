import React, { useId } from "react";
import { Checkbox as UiCheckbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, disabled, id }) => {
  const generatedId = useId();
  const inputId = id ?? `checkbox-${generatedId}`;

  const handleCheckedChange = (value: boolean | "indeterminate") => {
    if (value === "indeterminate") return;
    onChange(value);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        disabled && "cursor-not-allowed opacity-70"
      )}
    >
      <UiCheckbox
        id={inputId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={handleCheckedChange}
      />
      {label && (
        <Label
          htmlFor={inputId}
          className={cn(
            "text-sm text-muted-foreground",
            disabled && "cursor-not-allowed"
          )}
        >
          {label}
        </Label>
      )}
    </div>
  );
};
