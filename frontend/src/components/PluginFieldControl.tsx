// input:  [plugin schema field metadata, current value, change handler, optional validation copy, and readonly mode]
// output: [`PluginFieldControl` component]
// pos:    [Shared field renderer for Program/Semester plugin management forms and plugin-system wizard setup sections using wrapper-light shadcn-aligned Field layouts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useEffect, useId, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SelectOption = {
  label: string;
  value: string;
};

type PluginSchemaField = {
  path: string;
  label?: string | null;
  type?: string | null;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
};

interface PluginFieldControlProps {
  field: PluginSchemaField;
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

const parseDateOrUndefined = (value: unknown) => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toIsoDate = (value?: Date) => (value ? format(value, "yyyy-MM-dd") : "");

export const PluginFieldControl: React.FC<PluginFieldControlProps> = ({
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
  const isInvalid = Boolean(error);
  const requiredMarker = field.required ? <span aria-hidden="true" className="text-destructive">*</span> : null;

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
        className="gap-3 py-1"
        data-invalid={isInvalid || undefined}
      >
        <FieldContent>
          <FieldLabel htmlFor={fieldId}>
            {label}
            {requiredMarker}
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
      <Field className="gap-2" data-invalid={isInvalid || undefined}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {requiredMarker}
        </FieldLabel>
        <Select value={String(value ?? "")} onValueChange={onChange} disabled={readOnly}>
          <SelectTrigger id={fieldId} aria-invalid={Boolean(error)}>
            <SelectValue placeholder={field.placeholder || "Select a value"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "textarea") {
    return (
      <Field className="gap-2" data-invalid={isInvalid || undefined}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {requiredMarker}
        </FieldLabel>
        <Textarea
          id={fieldId}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={readOnly}
          aria-invalid={Boolean(error)}
        />
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "number") {
    return (
      <Field className="gap-2" data-invalid={isInvalid || undefined}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {requiredMarker}
        </FieldLabel>
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
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "date") {
    const selectedDate = parseDateOrUndefined(value);
    const dateLabel = selectedDate
      ? format(selectedDate, "PP")
      : field.placeholder || "Pick a date";

    return (
      <Field className="gap-2" data-invalid={isInvalid || undefined}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {requiredMarker}
        </FieldLabel>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={fieldId}
              type="button"
              variant="outline"
              data-empty={!selectedDate}
              aria-invalid={Boolean(error)}
              disabled={readOnly}
              className={cn(
                "w-full min-w-0 justify-start overflow-hidden text-left font-normal data-[empty=true]:text-muted-foreground",
              )}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              <span className="truncate">{dateLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              autoFocus
              mode="single"
              selected={selectedDate}
              onSelect={(nextDate) => onChange?.(toIsoDate(nextDate))}
            />
          </PopoverContent>
        </Popover>
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "json") {
    return (
      <Field className="gap-2" data-invalid={Boolean(error || jsonError) || undefined}>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {requiredMarker}
        </FieldLabel>
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
        {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
        {!error && jsonError ? <FieldError>{jsonError}</FieldError> : null}
      </Field>
    );
  }

  return (
    <Field className="gap-2" data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {requiredMarker}
      </FieldLabel>
      <Input
        id={fieldId}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
      />
      {helperText ? <FieldDescription>{helperText}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
};
