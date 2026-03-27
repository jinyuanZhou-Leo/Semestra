// input:  [plugin governance field metadata, current value, change handler, and optional readonly mode]
// output: [`PluginGovernanceFieldControl` component]
// pos:    [Shared field renderer for Program/Semester governance forms and wizard setup sections]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useId } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type SelectOption = {
  label: string;
  value: string;
};

type GovernanceField = {
  path: string;
  label?: string | null;
  type?: string | null;
  description?: string;
  options?: SelectOption[];
};

interface PluginGovernanceFieldControlProps {
  field: GovernanceField;
  value: unknown;
  onChange?: (value: unknown) => void;
  readOnly?: boolean;
  description?: string;
}

export const PluginGovernanceFieldControl: React.FC<PluginGovernanceFieldControlProps> = ({
  field,
  value,
  onChange,
  readOnly = false,
  description,
}) => {
  const label = field.label ?? field.path;
  const helperText = description ?? field.description ?? "";
  const fieldId = useId();

  if (field.type === "boolean") {
    return (
      <Field orientation="responsive" className="rounded-2xl border border-border/70 bg-background px-4 py-3">
        <FieldContent>
          <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
          {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        </FieldContent>
        <Switch id={fieldId} checked={Boolean(value)} onCheckedChange={onChange} disabled={readOnly} className="shrink-0" />
      </Field>
    );
  }

  if (field.type === "select") {
    return (
      <Field className="rounded-2xl border border-border/70 bg-background p-4">
        <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        <Select value={String(value ?? "")} onValueChange={onChange} disabled={readOnly}>
          <SelectTrigger id={fieldId}>
            <SelectValue placeholder="Select a value" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  return (
    <Field className="rounded-2xl border border-border/70 bg-background p-4">
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
      <Input id={fieldId} value={String(value ?? "")} onChange={(event) => onChange?.(event.target.value)} readOnly={readOnly} />
    </Field>
  );
};
