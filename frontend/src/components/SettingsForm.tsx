import React, { useEffect, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GPAScalingTable } from "./GPAScalingTable";
import { SaveSettingButton } from "./SaveSettingButton";

interface SettingsFormProps {
  initialName: string;
  initialSettings?: any;
  onSave: (data: any) => Promise<void>;
  onSuccess?: () => void | Promise<void>;
  type: "program" | "semester" | "course";
  submitLabel?: string;
  animateSubmitButton?: boolean;
  showCancel?: boolean;
  onCancel?: () => void;
}

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

export const SettingsForm: React.FC<SettingsFormProps> = ({
  initialName,
  initialSettings = {},
  onSave,
  onSuccess,
  type,
  submitLabel = "Save Changes",
  animateSubmitButton = true,
  showCancel = false,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const [alias, setAlias] = useState(initialSettings?.alias || "");
  const [category, setCategory] = useState(initialSettings?.category || "");
  const [extraSettings, setExtraSettings] = useState(initialSettings);
  const [jsonError, setJsonError] = useState("");
  const [gpaTableJson, setGpaTableJson] = useState("{}");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">(
    "idle"
  );
  const fieldId = useId();

  const settingsKey = useMemo(
    () => JSON.stringify(initialSettings ?? {}),
    [initialSettings]
  );

  useEffect(() => {
    setName(initialName);
    setAlias(initialSettings?.alias || "");
    setCategory(initialSettings?.category || "");
    setExtraSettings({
      ...initialSettings,
      include_in_gpa:
        initialSettings.include_in_gpa !== undefined
          ? initialSettings.include_in_gpa
          : true,
      hide_gpa:
        initialSettings.hide_gpa !== undefined
          ? initialSettings.hide_gpa
          : false,
    });
    if (type === "program" && initialSettings.gpa_scaling_table) {
      setGpaTableJson(initialSettings.gpa_scaling_table);
    } else {
      setGpaTableJson("{}");
    }
    setJsonError("");
  }, [initialName, settingsKey, type]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveState === "saving") return;

    if (type === "program") {
      try {
        JSON.parse(gpaTableJson);
        setJsonError("");
      } catch {
        setJsonError("Invalid JSON for GPA Table");
        return;
      }
    }

    const data: any = { name };

    if (type === "program" || type === "course") {
      data.credits = parseFloat(extraSettings.credits || 0);
    }

    if (type === "program") {
      data.grad_requirement_credits = parseFloat(
        extraSettings.grad_requirement_credits || 0
      );
      data.hide_gpa = extraSettings.hide_gpa;
    } else if (type === "course") {
      data.alias = alias || null;
      data.category = category || null;
      data.credits = parseFloat(extraSettings.credits || 0);
      data.include_in_gpa = extraSettings.include_in_gpa;
      data.hide_gpa = extraSettings.hide_gpa;
    }

    if (type === "program") {
      data.gpa_scaling_table = gpaTableJson;
    }

    setSaveState("saving");

    try {
      await onSave(data);
      setSaveState("success");

      await wait(700);
      setSaveState("idle");

      await wait(220);
      await onSuccess?.();
    } catch (error) {
      console.error("Failed to save settings", error);
      setSaveState("idle");
    }
  };

  const hideGpaId = `${fieldId}-hide-gpa`;
  const includeGpaId = `${fieldId}-include-gpa`;
  const hideGpaCourseId = `${fieldId}-course-hide-gpa`;

  return (
    <form onSubmit={handleSave} className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor={`${fieldId}-name`}>Name</Label>
        <Input
          id={`${fieldId}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {type === "program" && (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${fieldId}-grad-credits`}>
              Graduation Requirement (Credits)
            </Label>
            <Input
              id={`${fieldId}-grad-credits`}
              type="number"
              step="0.5"
              value={extraSettings.grad_requirement_credits || ""}
              onChange={(e) =>
                setExtraSettings({
                  ...extraSettings,
                  grad_requirement_credits: e.target.value,
                })
              }
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id={hideGpaId}
              checked={extraSettings.hide_gpa ?? false}
              onCheckedChange={(checked) => {
                if (checked === "indeterminate") return;
                setExtraSettings({ ...extraSettings, hide_gpa: checked });
              }}
            />
            <Label htmlFor={hideGpaId} className="text-sm text-muted-foreground">
              Hide GPA Info
            </Label>
          </div>
        </div>
      )}

      {type === "course" && (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${fieldId}-alias`}>Alias (optional)</Label>
            <Input
              id={`${fieldId}-alias`}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. CS101 - Prof. Smith"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${fieldId}-category`}>Category (optional)</Label>
            <Input
              id={`${fieldId}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. CS"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${fieldId}-credits`}>Credits</Label>
            <Input
              id={`${fieldId}-credits`}
              type="number"
              step="0.5"
              value={extraSettings.credits || ""}
              onChange={(e) =>
                setExtraSettings({ ...extraSettings, credits: e.target.value })
              }
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id={includeGpaId}
                checked={extraSettings.include_in_gpa ?? true}
                onCheckedChange={(checked) => {
                  if (checked === "indeterminate") return;
                  setExtraSettings({ ...extraSettings, include_in_gpa: checked });
                }}
              />
              <Label htmlFor={includeGpaId} className="text-sm text-muted-foreground">
                Include in GPA
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id={hideGpaCourseId}
                checked={extraSettings.hide_gpa ?? false}
                onCheckedChange={(checked) => {
                  if (checked === "indeterminate") return;
                  setExtraSettings({ ...extraSettings, hide_gpa: checked });
                }}
              />
              <Label htmlFor={hideGpaCourseId} className="text-sm text-muted-foreground">
                Hide GPA Info
              </Label>
            </div>
          </div>
        </div>
      )}

      {type === "program" && (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>GPA Scaling Table</Label>
            <GPAScalingTable
              value={gpaTableJson}
              onChange={(newValue) => {
                setGpaTableJson(newValue);
                setJsonError("");
              }}
            />
          </div>
          {jsonError && (
            <p className="text-sm text-destructive">{jsonError}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {showCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={saveState === "saving"}
          >
            Cancel
          </Button>
        )}
        <SaveSettingButton
          type="submit"
          label={submitLabel}
          saveState={saveState}
          animated={animateSubmitButton}
        />
      </div>
    </form>
  );
};
