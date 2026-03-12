// input:  [program name/credits/GPA defaults, discovered subject codes, course color-picker presets, and auto-save lifecycle callbacks]
// output: [`ProgramSettingsPanel` component]
// pos:    [Program-level settings form rendered inside program dashboard modal with debounced auto-save persistence plus Program-scoped subject-color management]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GPAScalingTable } from "./GPAScalingTable";
import { useAutoSave } from "@/hooks/useAutoSave";
import { ColorPicker, type ColorPickerPreset } from "@/components/ui/color-picker";
import {
  getAutomaticSubjectColor,
  normalizeSubjectCode,
  parseSubjectColorMap,
  serializeSubjectColorMap,
} from "@/utils/courseCategoryBadge";

const SUBJECT_COLOR_PRESETS: readonly ColorPickerPreset[] = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Cyan', value: '#0891b2' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Amber', value: '#ca8a04' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Lime', value: '#65a30d' },
  { name: 'Burnt Orange', value: '#c2410c' },
] as const;

interface ProgramSettingsPanelProps {
  initialName: string;
  initialSettings: {
    grad_requirement_credits?: number;
    gpa_scaling_table?: string;
    subject_color_map?: string;
    hide_gpa?: boolean;
  };
  subjectCodes?: string[];
  onSave: (data: {
    name: string;
    grad_requirement_credits: number;
    gpa_scaling_table: string;
    subject_color_map: string;
    hide_gpa: boolean;
  }) => Promise<void>;
  showCancel?: boolean;
  onCancel?: () => void;
}

export const ProgramSettingsPanel: React.FC<ProgramSettingsPanelProps> = ({
  initialName,
  initialSettings,
  subjectCodes = [],
  onSave,
  showCancel = false,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const [gradCredits, setGradCredits] = useState(String(initialSettings?.grad_requirement_credits || ""));
  const [hideGpa, setHideGpa] = useState(initialSettings?.hide_gpa ?? false);
  const [gpaTableJson, setGpaTableJson] = useState(initialSettings?.gpa_scaling_table || "{}");
  const [subjectColorMap, setSubjectColorMap] = useState<Record<string, string>>(
    parseSubjectColorMap(initialSettings?.subject_color_map),
  );
  const [subjectCodeDraft, setSubjectCodeDraft] = useState("");
  const [jsonError, setJsonError] = useState("");
  const fieldId = useId();
  const initialGradCredits = String(initialSettings?.grad_requirement_credits || "");
  const initialHideGpa = initialSettings?.hide_gpa ?? false;
  const initialGpaTableJson = initialSettings?.gpa_scaling_table || "{}";
  const initialSubjectColorMap = useMemo(
    () => parseSubjectColorMap(initialSettings?.subject_color_map),
    [initialSettings?.subject_color_map],
  );
  const initialSubjectColorMapJson = useMemo(
    () => serializeSubjectColorMap(initialSubjectColorMap),
    [initialSubjectColorMap],
  );
  const normalizedSubjectCodes = useMemo(
    () => subjectCodes.map((code) => normalizeSubjectCode(code)).filter(Boolean),
    [subjectCodes],
  );
  const visibleSubjectCodes = useMemo(
    () => Array.from(new Set([...normalizedSubjectCodes, ...Object.keys(subjectColorMap)])).sort((left, right) => left.localeCompare(right)),
    [normalizedSubjectCodes, subjectColorMap],
  );
  const subjectColorMapJson = useMemo(
    () => serializeSubjectColorMap(subjectColorMap),
    [subjectColorMap],
  );
  const savedSnapshot = useMemo(
    () => ({
      name: initialName,
      gradCredits: initialGradCredits,
      hideGpa: initialHideGpa,
      gpaTableJson: initialGpaTableJson,
      subjectColorMapJson: initialSubjectColorMapJson,
    }),
    [initialGpaTableJson, initialGradCredits, initialHideGpa, initialName, initialSubjectColorMapJson],
  );
  const draftSnapshot = useMemo(
    () => ({
      name,
      gradCredits,
      hideGpa,
      gpaTableJson,
      subjectColorMapJson,
    }),
    [gpaTableJson, gradCredits, hideGpa, name, subjectColorMapJson],
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);

  useEffect(() => {
    const previousSnapshot = lastLoadedSnapshotRef.current;
    const externalChanged =
      previousSnapshot.name !== savedSnapshot.name ||
      previousSnapshot.gradCredits !== savedSnapshot.gradCredits ||
      previousSnapshot.hideGpa !== savedSnapshot.hideGpa ||
      previousSnapshot.gpaTableJson !== savedSnapshot.gpaTableJson ||
      previousSnapshot.subjectColorMapJson !== savedSnapshot.subjectColorMapJson;
    const draftHasLocalChanges =
      previousSnapshot.name !== draftSnapshot.name ||
      previousSnapshot.gradCredits !== draftSnapshot.gradCredits ||
      previousSnapshot.hideGpa !== draftSnapshot.hideGpa ||
      previousSnapshot.gpaTableJson !== draftSnapshot.gpaTableJson ||
      previousSnapshot.subjectColorMapJson !== draftSnapshot.subjectColorMapJson;
    const incomingMatchesDraft =
      savedSnapshot.name === draftSnapshot.name &&
      savedSnapshot.gradCredits === draftSnapshot.gradCredits &&
      savedSnapshot.hideGpa === draftSnapshot.hideGpa &&
      savedSnapshot.gpaTableJson === draftSnapshot.gpaTableJson &&
      savedSnapshot.subjectColorMapJson === draftSnapshot.subjectColorMapJson;

    lastLoadedSnapshotRef.current = savedSnapshot;
    if (!externalChanged) return;
    if (draftHasLocalChanges && !incomingMatchesDraft) return;

    setName(savedSnapshot.name);
    setGradCredits(savedSnapshot.gradCredits);
    setHideGpa(savedSnapshot.hideGpa);
    setGpaTableJson(savedSnapshot.gpaTableJson);
    setSubjectColorMap(initialSubjectColorMap);
    setJsonError("");
  }, [draftSnapshot, initialSubjectColorMap, savedSnapshot]);

  const { isValid } = useAutoSave({
    value: draftSnapshot,
    savedValue: savedSnapshot,
    validate: (snapshot) => {
      try {
        JSON.parse(snapshot.gpaTableJson);
        JSON.parse(snapshot.subjectColorMapJson);
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
        subject_color_map: snapshot.subjectColorMapJson,
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

    setJsonError("Invalid JSON in program settings");
  }, [isValid]);

  const addSubjectCode = () => {
    const normalizedCode = normalizeSubjectCode(subjectCodeDraft);
    if (!normalizedCode) return;
    setSubjectColorMap((current) => ({
      ...current,
      [normalizedCode]: current[normalizedCode] ?? getAutomaticSubjectColor(normalizedCode),
    }));
    setSubjectCodeDraft("");
  };

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
        <div className="space-y-1">
          <Label>Subject Colors</Label>
          <p className="text-sm text-muted-foreground">
            Set default colors for course codes such as APS or MAT. Courses still can override this in Course Settings.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border/70 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={subjectCodeDraft}
              onChange={(event) => setSubjectCodeDraft(event.target.value.toUpperCase())}
              placeholder="Add subject code (e.g. APS)"
              className="sm:max-w-[220px]"
            />
            <Button type="button" variant="outline" onClick={addSubjectCode}>
              Add Subject Code
            </Button>
          </div>

          {visibleSubjectCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Subject codes will appear here after courses such as APS105 or MAT180 are detected.
            </p>
          ) : (
            <div className="grid gap-4">
              {visibleSubjectCodes.map((subjectCode) => {
                const automaticColor = getAutomaticSubjectColor(subjectCode);
                const selectedColor = subjectColorMap[subjectCode] ?? automaticColor;
                const isCustomized = Boolean(subjectColorMap[subjectCode]);

                return (
                  <div key={subjectCode} className="rounded-xl border border-border/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{subjectCode}</span>
                          <span
                            className="h-3 w-3 rounded-full border border-border/70"
                            style={{ backgroundColor: selectedColor }}
                            aria-hidden="true"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isCustomized ? "Using a Program-level custom color." : "Using the stable automatic color."}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 lg:w-[320px]">
                        <ColorPicker
                          id={`${fieldId}-subject-color-${subjectCode}`}
                          label="Default Color"
                          value={selectedColor}
                          onChange={(color) => {
                            setSubjectColorMap((current) => ({
                              ...current,
                              [subjectCode]: color,
                            }));
                          }}
                          defaultColor={automaticColor}
                          presetColors={SUBJECT_COLOR_PRESETS}
                          triggerAriaLabel={`Choose Program default color for ${subjectCode}`}
                          resetLabel="Use automatic color"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="justify-start px-0 text-muted-foreground"
                          onClick={() => {
                            setSubjectColorMap((current) => {
                              const next = { ...current };
                              delete next[subjectCode];
                              return next;
                            });
                          }}
                        >
                          Reset to automatic
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
