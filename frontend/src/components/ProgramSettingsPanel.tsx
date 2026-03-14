// input:  [program name/credits/GPA defaults, discovered subject codes, course color-picker presets, and auto-save lifecycle callbacks]
// output: [`ProgramSettingsPanel` component]
// pos:    [Program-level settings form rendered inside program dashboard modal with debounced auto-save persistence, shadcn Field-based layout, and Program-scoped stable subject-color management]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ColorPicker, type ColorPickerPreset } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAutoSave } from "@/hooks/useAutoSave";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  normalizeSubjectCode,
  parseSubjectColorMap,
  resolveSubjectColorAssignments,
  serializeSubjectColorMap,
} from "@/utils/courseCategoryBadge";

import { CrudPanel } from "./CrudPanel";
import { GPAScalingTable } from "./GPAScalingTable";
import { SettingsSection } from "./SettingsSection";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";

const SUBJECT_COLOR_PRESETS: readonly ColorPickerPreset[] = [
  { name: "Blue", value: "#2563eb" },
  { name: "Red", value: "#dc2626" },
  { name: "Green", value: "#16a34a" },
  { name: "Orange", value: "#ea580c" },
  { name: "Cyan", value: "#0891b2" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Amber", value: "#ca8a04" },
  { name: "Pink", value: "#db2777" },
  { name: "Teal", value: "#0f766e" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Lime", value: "#65a30d" },
  { name: "Burnt Orange", value: "#c2410c" },
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
  registerFlush?: (flush: () => Promise<void>) => void;
  showCancel?: boolean;
  onCancel?: () => void;
}

export const ProgramSettingsPanel: React.FC<ProgramSettingsPanelProps> = ({
  initialName,
  initialSettings,
  subjectCodes = [],
  onSave,
  registerFlush,
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
    () => normalizedSubjectCodes,
    [normalizedSubjectCodes],
  );
  const persistedAndVisibleSubjectCodes = useMemo(
    () => Array.from(new Set([...Object.keys(subjectColorMap), ...visibleSubjectCodes])),
    [subjectColorMap, visibleSubjectCodes],
  );
  const resolvedSubjectColorMap = useMemo(
    () => resolveSubjectColorAssignments(persistedAndVisibleSubjectCodes, subjectColorMap),
    [persistedAndVisibleSubjectCodes, subjectColorMap],
  );
  const persistedSubjectColorMap = useMemo(
    () => ({
      ...subjectColorMap,
      ...Object.fromEntries(
        visibleSubjectCodes
          .map((code) => [code, resolvedSubjectColorMap[code]])
          .filter((entry): entry is [string, string] => Boolean(entry[1])),
      ),
    }),
    [resolvedSubjectColorMap, subjectColorMap, visibleSubjectCodes],
  );
  const subjectColorMapJson = useMemo(
    () => serializeSubjectColorMap(persistedSubjectColorMap),
    [persistedSubjectColorMap],
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

  const { isValid, flush } = useAutoSave({
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

  const flushRef = useRef(flush);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    registerFlush?.(flush);
  }, [flush, registerFlush]);

  useEffect(() => {
    return () => {
      void flushRef.current();
    };
  }, []);

  return (
    <div className="space-y-4">
      <SettingsSection
        title="General"
        description="Update core Program details and visibility preferences."
        contentClassName="space-y-6"
      >
        <FieldSet>
          <FieldGroup>
            <Field className="max-w-sm">
              <FieldLabel htmlFor={`${fieldId}-name`}>Program Name</FieldLabel>
              <Input
                id={`${fieldId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>

            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-grad-credits`}>Graduation Credits</FieldLabel>
                <FieldDescription>
                  The total credits required to complete this Program.
                </FieldDescription>
              </FieldContent>
              <div className="w-full @md/field-group:w-[140px] @md/field-group:shrink-0">
                <Input
                  id={`${fieldId}-grad-credits`}
                  type="number"
                  step="0.5"
                  value={gradCredits}
                  onChange={(event) => setGradCredits(event.target.value)}
                  required
                />
              </div>
            </Field>

            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-hide-gpa`}>Hide GPA Info</FieldLabel>
                <FieldDescription>
                  Remove GPA details from Program-level views.
                </FieldDescription>
              </FieldContent>
              <Switch
                id={`${fieldId}-hide-gpa`}
                checked={hideGpa}
                onCheckedChange={setHideGpa}
                aria-label="Hide GPA Info"
                className="shrink-0"
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </SettingsSection>

      <SettingsSection
        title="Course Code Colors"
        description="Set the default color for each course code prefix in this Program. Courses can still use their own custom override when needed."
        contentClassName="space-y-5"
      >
        <CrudPanel
          title="Course Code Colors"
          description="Manage the default color used for each course code prefix in this Program."
          minWidthClassName="min-w-[720px]"
          items={visibleSubjectCodes}
          emptyMessage="Subject codes appear here after courses such as APS105 or MAT180 are detected."
          renderHeader={() => (
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead className="w-[420px]">Color</TableHead>
              <TableHead className="w-[88px] text-right">Action</TableHead>
            </TableRow>
          )}
          renderRow={(subjectCode) => {
            const automaticColor = resolvedSubjectColorMap[subjectCode];
            const selectedColor = subjectColorMap[subjectCode] ?? automaticColor;

            return (
              <TableRow key={subjectCode}>
                <TableCell>
                  <span className="font-mono text-sm font-semibold tracking-[0.12em]">
                    {subjectCode}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <div className="w-full min-w-[240px]">
                    <ColorPicker
                      id={`${fieldId}-subject-color-${subjectCode}`}
                      value={selectedColor}
                      onChange={(color) => {
                        setSubjectColorMap((current) => ({
                          ...current,
                          [subjectCode]: color,
                        }));
                      }}
                      presetColors={SUBJECT_COLOR_PRESETS}
                      triggerAriaLabel={`Choose Program default color for ${subjectCode}`}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label={`Reset ${subjectCode} to automatic color`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset {subjectCode} color?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the Program override and restores the automatic default color for {subjectCode}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => {
                            setSubjectColorMap((current) => {
                              const next = { ...current };
                              delete next[subjectCode];
                              return next;
                            });
                          }}
                        >
                          Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            );
          }}
        />
      </SettingsSection>

      <SettingsSection
        title="GPA Scaling"
        description="Define the score-to-GPA conversion table used by this Program."
        contentClassName="space-y-3"
      >
        <GPAScalingTable
          value={gpaTableJson}
          onChange={(newValue) => {
            setGpaTableJson(newValue);
            setJsonError("");
          }}
        />
        {jsonError ? <FieldError>{jsonError}</FieldError> : null}
      </SettingsSection>

      {showCancel ? (
        <div className="flex items-center justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
};
