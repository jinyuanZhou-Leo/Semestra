// input:  [plugin setup titles, descriptions, errors, children, and review item content]
// output: [shared plugin setup form/review primitives for controlled wizard layout and typography]
// pos:    [Wrapper-light setup UI primitive layer that keeps plugin-authored setup and review surfaces inside host-owned shadcn form shells]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

type PluginSetupSurfaceProps = {
  generalErrors?: string[];
  children: React.ReactNode;
};

type PluginSetupSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  separated?: boolean;
};

type PluginSetupFieldProps = {
  label?: string;
  description?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
};

type PluginSetupReviewItemProps = {
  label: string;
  value: React.ReactNode;
  description?: string;
};

export const PluginSetupFormSurface: React.FC<PluginSetupSurfaceProps> = ({
  generalErrors = [],
  children,
}) => (
  <div className="flex flex-col gap-6">
    {generalErrors.length > 0 ? (
      <div className="flex flex-col gap-3">
        {generalErrors.map((message, index) => (
          <Alert key={`plugin-setup-general-error:${index}`} variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ))}
      </div>
    ) : null}
    {children}
  </div>
);

export const PluginSetupFormSection: React.FC<PluginSetupSectionProps> = ({
  title,
  description,
  children,
  separated = false,
}) => (
  <>
    {separated ? <Separator /> : null}
    <FieldSet className="gap-5">
      <div className="flex flex-col gap-1">
        <FieldLegend>{title}</FieldLegend>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </div>
      <FieldGroup className="gap-5">
        {children}
      </FieldGroup>
    </FieldSet>
  </>
);

export const PluginSetupFormField: React.FC<PluginSetupFieldProps> = ({
  label,
  description,
  error,
  htmlFor,
  children,
}) => (
  <Field className="gap-2" data-invalid={Boolean(error) || undefined}>
    {label ? <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel> : null}
    <FieldContent className="gap-3">
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldContent>
  </Field>
);

export const PluginSetupFormReviewItem: React.FC<PluginSetupReviewItemProps> = ({
  label,
  value,
  description,
}) => (
  <Field className="gap-2">
    <FieldLabel className="text-muted-foreground">{label}</FieldLabel>
    <FieldContent className="gap-1">
      <div className="text-sm font-medium text-foreground">{value}</div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </FieldContent>
  </Field>
);
