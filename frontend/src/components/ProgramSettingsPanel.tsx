// input:  [program name/credits/GPA defaults, GPA table editor, save/cancel lifecycle callbacks]
// output: [`ProgramSettingsPanel` component]
// pos:    [Program-level settings form rendered inside program dashboard modal]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GPAScalingTable } from "./GPAScalingTable";
import { SaveSettingButton } from "./SaveSettingButton";

interface ProgramSettingsPanelProps {
  initialName: string;
  initialSettings: {
    grad_requirement_credits?: number;
    gpa_scaling_table?: string;
    hide_gpa?: boolean;
  };
  onSave: (data: {
    name: string;
    grad_requirement_credits: number;
    gpa_scaling_table: string;
    hide_gpa: boolean;
  }) => Promise<void>;
  onSuccess?: () => void | Promise<void>;
  showCancel?: boolean;
  onCancel?: () => void;
}

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

export const ProgramSettingsPanel: React.FC<ProgramSettingsPanelProps> = ({
  initialName,
  initialSettings,
  onSave,
  onSuccess,
  showCancel = false,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const [gradCredits, setGradCredits] = useState(String(initialSettings?.grad_requirement_credits || ""));
  const [hideGpa, setHideGpa] = useState(initialSettings?.hide_gpa ?? false);
  const [gpaTableJson, setGpaTableJson] = useState(initialSettings?.gpa_scaling_table || "{}");
  const [jsonError, setJsonError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">("idle");
  const fieldId = useId();
  const initialGradCredits = String(initialSettings?.grad_requirement_credits || "");
  const initialHideGpa = initialSettings?.hide_gpa ?? false;
  const initialGpaTableJson = initialSettings?.gpa_scaling_table || "{}";

  useEffect(() => {
    setName(initialName);
    setGradCredits(initialGradCredits);
    setHideGpa(initialHideGpa);
    setGpaTableJson(initialGpaTableJson);
    setJsonError("");
  }, [initialName, initialGradCredits, initialHideGpa, initialGpaTableJson]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveState === "saving") return;

    try {
      JSON.parse(gpaTableJson);
      setJsonError("");
    } catch {
      setJsonError("Invalid JSON for GPA Table");
      return;
    }

    setSaveState("saving");

    try {
      await onSave({
        name,
        grad_requirement_credits: parseFloat(gradCredits) || 0,
        gpa_scaling_table: gpaTableJson,
        hide_gpa: hideGpa,
      });
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

      <div className="grid gap-2">
        <Label htmlFor={`${fieldId}-grad-credits`}>Graduation Requirement (Credits)</Label>
        <Input
          id={`${fieldId}-grad-credits`}
          type="number"
          step="0.5"
          value={gradCredits}
          onChange={(e) => setGradCredits(e.target.value)}
          required
        />
      </div>

      <div className="flex items-center gap-3">
        <Checkbox
          id={`${fieldId}-hide-gpa`}
          checked={hideGpa}
          onCheckedChange={(checked) => {
            if (checked === "indeterminate") return;
            setHideGpa(checked);
          }}
        />
        <Label htmlFor={`${fieldId}-hide-gpa`} className="text-sm text-muted-foreground">
          Hide GPA Info
        </Label>
      </div>

      <div className="grid gap-3">
        <Label>GPA Scaling Table</Label>
        <GPAScalingTable
          value={gpaTableJson}
          onChange={(newValue) => {
            setGpaTableJson(newValue);
            setJsonError("");
          }}
        />
        {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
      </div>

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
          label="Save Changes"
          saveState={saveState}
          animated
        />
      </div>
    </form>
  );
};
