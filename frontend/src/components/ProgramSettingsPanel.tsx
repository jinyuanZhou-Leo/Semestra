// input:  [program name/credits/GPA defaults, GPA table editor, auto-save lifecycle callbacks, and optional close action]
// output: [`ProgramSettingsPanel` component]
// pos:    [Program-level settings form rendered inside program dashboard modal with debounced auto-save persistence]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GPAScalingTable } from "./GPAScalingTable";
import { useAutoSave } from "@/hooks/useAutoSave";

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
  showCancel?: boolean;
  onCancel?: () => void;
}

export const ProgramSettingsPanel: React.FC<ProgramSettingsPanelProps> = ({
  initialName,
  initialSettings,
  onSave,
  showCancel = false,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const [gradCredits, setGradCredits] = useState(String(initialSettings?.grad_requirement_credits || ""));
  const [hideGpa, setHideGpa] = useState(initialSettings?.hide_gpa ?? false);
  const [gpaTableJson, setGpaTableJson] = useState(initialSettings?.gpa_scaling_table || "{}");
  const [jsonError, setJsonError] = useState("");
  const fieldId = useId();
  const initialGradCredits = String(initialSettings?.grad_requirement_credits || "");
  const initialHideGpa = initialSettings?.hide_gpa ?? false;
  const initialGpaTableJson = initialSettings?.gpa_scaling_table || "{}";
  const savedSnapshot = useMemo(
    () => ({
      name: initialName,
      gradCredits: initialGradCredits,
      hideGpa: initialHideGpa,
      gpaTableJson: initialGpaTableJson,
    }),
    [initialGpaTableJson, initialGradCredits, initialHideGpa, initialName]
  );
  const draftSnapshot = useMemo(
    () => ({
      name,
      gradCredits,
      hideGpa,
      gpaTableJson,
    }),
    [gpaTableJson, gradCredits, hideGpa, name]
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);

  useEffect(() => {
    const previousSnapshot = lastLoadedSnapshotRef.current;
    const externalChanged =
      previousSnapshot.name !== savedSnapshot.name ||
      previousSnapshot.gradCredits !== savedSnapshot.gradCredits ||
      previousSnapshot.hideGpa !== savedSnapshot.hideGpa ||
      previousSnapshot.gpaTableJson !== savedSnapshot.gpaTableJson;
    const draftHasLocalChanges =
      previousSnapshot.name !== draftSnapshot.name ||
      previousSnapshot.gradCredits !== draftSnapshot.gradCredits ||
      previousSnapshot.hideGpa !== draftSnapshot.hideGpa ||
      previousSnapshot.gpaTableJson !== draftSnapshot.gpaTableJson;
    const incomingMatchesDraft =
      savedSnapshot.name === draftSnapshot.name &&
      savedSnapshot.gradCredits === draftSnapshot.gradCredits &&
      savedSnapshot.hideGpa === draftSnapshot.hideGpa &&
      savedSnapshot.gpaTableJson === draftSnapshot.gpaTableJson;

    lastLoadedSnapshotRef.current = savedSnapshot;
    if (!externalChanged) return;
    if (draftHasLocalChanges && !incomingMatchesDraft) return;

    setName(savedSnapshot.name);
    setGradCredits(savedSnapshot.gradCredits);
    setHideGpa(savedSnapshot.hideGpa);
    setGpaTableJson(savedSnapshot.gpaTableJson);
    setJsonError("");
  }, [draftSnapshot, savedSnapshot]);

  const { isValid } = useAutoSave({
    value: draftSnapshot,
    savedValue: savedSnapshot,
    validate: (snapshot) => {
      try {
        JSON.parse(snapshot.gpaTableJson);
        return true;
      } catch {
        return false;
      }
    },
    onSave: async (snapshot) => {
      setJsonError("");
      await onSave({
        name: snapshot.name,
        grad_requirement_credits: parseFloat(snapshot.gradCredits) || 0,
        gpa_scaling_table: snapshot.gpaTableJson,
        hide_gpa: snapshot.hideGpa,
      });
    },
    onError: (error) => {
      console.error("Failed to save settings", error);
    },
  });

  useEffect(() => {
    if (isValid) {
      setJsonError("");
      return;
    }

    setJsonError("Invalid JSON for GPA Table");
  }, [isValid]);

  return (
    <div className="grid gap-6">
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
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
