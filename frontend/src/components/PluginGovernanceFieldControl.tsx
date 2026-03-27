// input:  [plugin governance/setup field metadata, current value, change handler, optional validation copy, and readonly mode]
// output: [`PluginGovernanceFieldControl` component]
// pos:    [Shared field renderer for Program/Semester governance forms and plugin-system wizard setup sections]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useId, useState } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type SelectOption = {
  label: string;
  value: string;
};

type GovernanceField = {
  path: string;
  label?: string | null;
  type?: string | null;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
};

interface PluginGovernanceFieldControlProps {
  field: GovernanceField;
  value: unknown;
  onChange?: (value: unknown) => void;
  readOnly?: boolean;
  description?: string;
  error?: string | null;
}

const formatJsonValue = (value: unknown) => {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const PluginGovernanceFieldControl: React.FC<PluginGovernanceFieldControlProps> = ({
  field,
  value,
  onChange,
  readOnly = false,
  description,
  error,
}) => {
  const label = field.label ?? field.path;
  const helperText = description ?? field.description ?? "";
  const fieldId = useId();
  const [jsonDraft, setJsonDraft] = useState(() => formatJsonValue(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (field.type === "json") {
      setJsonDraft(formatJsonValue(value));
      setJsonError(null);
    }
  }, [field.type, value]);

  if (field.type === "boolean") {
    return (
      <Field
        orientation="responsive"
        className="rounded-2xl border border-border/70 bg-background px-4 py-3"
        data-invalid={Boolean(error)}
      >
        <FieldContent>
          <FieldLabel htmlFor={fieldId}>
            {label}
            {field.required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
          </FieldLabel>
          {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </FieldContent>
        <Switch
          id={fieldId}
          checked={Boolean(value)}
          onCheckedChange={onChange}
          disabled={readOnly}
          aria-invalid={Boolean(error)}
          className="shrink-0"
        />
      </Field>
    );
  }

  if (field.type === "select") {
    return (
      <Field className="rounded-2xl border border-border/70 bg-background p-4" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {field.required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
        </FieldLabel>
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        <Select value={String(value ?? "")} onValueChange={onChange} disabled={readOnly}>
          <SelectTrigger id={fieldId} aria-invalid={Boolean(error)}>
            <SelectValue placeholder={field.placeholder || "Select a value"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "textarea") {
    return (
      <Field className="rounded-2xl border border-border/70 bg-background p-4" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {field.required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
        </FieldLabel>
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        <Textarea
          id={fieldId}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={readOnly}
          aria-invalid={Boolean(error)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "number") {
    return (
      <Field className="rounded-2xl border border-border/70 bg-background p-4" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {field.required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
        </FieldLabel>
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        <Input
          id={fieldId}
          type="number"
          value={value == null ? "" : String(value)}
          placeholder={field.placeholder}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange?.(nextValue === "" ? null : Number(nextValue));
          }}
          readOnly={readOnly}
          aria-invalid={Boolean(error)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "date") {
    return (
      <Field className="rounded-2xl border border-border/70 bg-background p-4" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {field.required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
        </FieldLabel>
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        <Input
          id={fieldId}
          type="date"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={readOnly}
          aria-invalid={Boolean(error)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "json") {
    return (
      <Field className="rounded-2xl border border-border/70 bg-background p-4" data-invalid={Boolean(error || jsonError)}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {field.required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
        </FieldLabel>
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        <Textarea
          id={fieldId}
          value={jsonDraft}
          placeholder={field.placeholder || '{\n  "key": "value"\n}'}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setJsonDraft(nextDraft);
            if (nextDraft.trim() === "") {
              setJsonError(null);
              onChange?.(null);
              return;
            }
            try {
              onChange?.(JSON.parse(nextDraft));
              setJsonError(null);
            } catch {
              setJsonError("Enter valid JSON.");
            }
          }}
          readOnly={readOnly}
          aria-invalid={Boolean(error || jsonError)}
          className="font-mono text-xs"
        />
        {error ? <FieldError>{error}</FieldError> : null}
        {!error && jsonError ? <FieldError>{jsonError}</FieldError> : null}
      </Field>
    );
  }

  return (
    <Field className="rounded-2xl border border-border/70 bg-background p-4" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {field.required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
      </FieldLabel>
      {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
      <Input
        id={fieldId}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
};
