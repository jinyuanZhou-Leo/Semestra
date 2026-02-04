import React, { useEffect, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { GPAScalingTable } from "./GPAScalingTable";

interface SettingsFormProps {
  initialName: string;
  initialSettings?: any;
  onSave: (data: any) => Promise<void>;
  type: "program" | "semester" | "course";
  submitLabel?: string;
  showCancel?: boolean;
  onCancel?: () => void;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({
  initialName,
  initialSettings = {},
  onSave,
  type,
  submitLabel = "Save Changes",
  showCancel = false,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const [alias, setAlias] = useState(initialSettings?.alias || "");
  const [extraSettings, setExtraSettings] = useState(initialSettings);
  const [jsonError, setJsonError] = useState("");
  const [gpaTableJson, setGpaTableJson] = useState("{}");
  const fieldId = useId();

  const settingsKey = useMemo(
    () => JSON.stringify(initialSettings ?? {}),
    [initialSettings]
  );

  useEffect(() => {
    setName(initialName);
    setAlias(initialSettings?.alias || "");
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
      data.credits = parseFloat(extraSettings.credits || 0);
      data.include_in_gpa = extraSettings.include_in_gpa;
      data.hide_gpa = extraSettings.hide_gpa;
    }

    if (type === "program") {
      data.gpa_scaling_table = gpaTableJson;
    }

    await onSave(data);
  };

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
          <Checkbox
            checked={extraSettings.hide_gpa ?? false}
            onChange={(checked) =>
              setExtraSettings({ ...extraSettings, hide_gpa: checked })
            }
            label="Hide GPA Info"
          />
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
            <Checkbox
              checked={extraSettings.include_in_gpa ?? true}
              onChange={(checked) =>
                setExtraSettings({ ...extraSettings, include_in_gpa: checked })
              }
              label="Include in GPA"
            />
            <Checkbox
              checked={extraSettings.hide_gpa ?? false}
              onChange={(checked) =>
                setExtraSettings({ ...extraSettings, hide_gpa: checked })
              }
              label="Hide GPA Info"
            />
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
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
};
