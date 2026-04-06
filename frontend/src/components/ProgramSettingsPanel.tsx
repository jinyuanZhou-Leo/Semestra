// input:  [program name/credits/GPA defaults, discovered subject codes, available LMS integrations, course color-picker presets, auto-save lifecycle callbacks, and shared data-table row-actions dropdown helpers]
// output: [`ProgramSettingsPanel` component]
// pos:    [Program-level settings form used by the dedicated Program settings route with debounced auto-save persistence, vertically stacked General settings rows, separated LMS/general sections, shared section-shell composition, stable subject-color management, adaptive mobile-safe course-color table sizing with an explicit subject-code minimum width, and a row-actions dropdown reset affordance]
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
} from "@/components/ui/alert-dialog";
import { ColorPicker, type ColorPickerPreset } from "@/components/ui/color-picker";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { DataTable, DataTableActionMenu } from "./DataTable";
import { GPAScalingTable } from "./GPAScalingTable";
import { SettingsSection } from "./SettingsSection";

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
    lms_integration_id?: string | null;
    has_lms_dependencies?: boolean;
  };
  lmsIntegrations?: Array<{ id: string; display_name: string; provider: string }>;
  subjectCodes?: string[];
  onSave: (data: {
    name: string;
    grad_requirement_credits: number;
    gpa_scaling_table: string;
    subject_color_map: string;
    hide_gpa: boolean;
    lms_integration_id: string | null;
  }) => Promise<void>;
  registerFlush?: (flush: () => Promise<void>) => void;
}

export const ProgramSettingsPanel: React.FC<ProgramSettingsPanelProps> = ({
  initialName,
  initialSettings,
  lmsIntegrations = [],
  subjectCodes = [],
  onSave,
  registerFlush,
}) => {
  const [name, setName] = useState(initialName);
  const [gradCredits, setGradCredits] = useState(String(initialSettings?.grad_requirement_credits || ""));
  const [hideGpa, setHideGpa] = useState(initialSettings?.hide_gpa ?? false);
  const [lmsIntegrationId, setLmsIntegrationId] = useState(initialSettings?.lms_integration_id ?? "__none__");
  const [gpaTableJson, setGpaTableJson] = useState(initialSettings?.gpa_scaling_table || "{}");
  const [subjectColorMap, setSubjectColorMap] = useState<Record<string, string>>(
    parseSubjectColorMap(initialSettings?.subject_color_map),
  );
  const [pendingResetSubjectCode, setPendingResetSubjectCode] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState("");
  const fieldId = useId();
  const initialGradCredits = String(initialSettings?.grad_requirement_credits || "");
  const initialHideGpa = initialSettings?.hide_gpa ?? false;
  const initialLmsIntegrationId = initialSettings?.lms_integration_id ?? "__none__";
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
      lmsIntegrationId: initialLmsIntegrationId,
      gpaTableJson: initialGpaTableJson,
      subjectColorMapJson: initialSubjectColorMapJson,
    }),
    [initialGpaTableJson, initialGradCredits, initialHideGpa, initialLmsIntegrationId, initialName, initialSubjectColorMapJson],
  );
  const draftSnapshot = useMemo(
    () => ({
      name,
      gradCredits,
      hideGpa,
      lmsIntegrationId,
      gpaTableJson,
      subjectColorMapJson,
    }),
    [gpaTableJson, gradCredits, hideGpa, lmsIntegrationId, name, subjectColorMapJson],
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);

  useEffect(() => {
    const previousSnapshot = lastLoadedSnapshotRef.current;
    const externalChanged =
      previousSnapshot.name !== savedSnapshot.name ||
      previousSnapshot.gradCredits !== savedSnapshot.gradCredits ||
      previousSnapshot.hideGpa !== savedSnapshot.hideGpa ||
      previousSnapshot.lmsIntegrationId !== savedSnapshot.lmsIntegrationId ||
      previousSnapshot.gpaTableJson !== savedSnapshot.gpaTableJson ||
      previousSnapshot.subjectColorMapJson !== savedSnapshot.subjectColorMapJson;
    const draftHasLocalChanges =
      previousSnapshot.name !== draftSnapshot.name ||
      previousSnapshot.gradCredits !== draftSnapshot.gradCredits ||
      previousSnapshot.hideGpa !== draftSnapshot.hideGpa ||
      previousSnapshot.lmsIntegrationId !== draftSnapshot.lmsIntegrationId ||
      previousSnapshot.gpaTableJson !== draftSnapshot.gpaTableJson ||
      previousSnapshot.subjectColorMapJson !== draftSnapshot.subjectColorMapJson;
    const incomingMatchesDraft =
      savedSnapshot.name === draftSnapshot.name &&
      savedSnapshot.gradCredits === draftSnapshot.gradCredits &&
      savedSnapshot.hideGpa === draftSnapshot.hideGpa &&
      savedSnapshot.lmsIntegrationId === draftSnapshot.lmsIntegrationId &&
      savedSnapshot.gpaTableJson === draftSnapshot.gpaTableJson &&
      savedSnapshot.subjectColorMapJson === draftSnapshot.subjectColorMapJson;

    lastLoadedSnapshotRef.current = savedSnapshot;
    if (!externalChanged) return;
    if (draftHasLocalChanges && !incomingMatchesDraft) return;

    setName(savedSnapshot.name);
    setGradCredits(savedSnapshot.gradCredits);
    setHideGpa(savedSnapshot.hideGpa);
    setLmsIntegrationId(savedSnapshot.lmsIntegrationId);
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
        lms_integration_id: snapshot.lmsIntegrationId === "__none__" ? null : snapshot.lmsIntegrationId,
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
          <FieldGroup className="flex flex-col gap-6">
            <Field>
              <FieldLabel htmlFor={`${fieldId}-name`}>Program Name</FieldLabel>
              <Input
                id={`${fieldId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${fieldId}-grad-credits`}>Graduation Credits</FieldLabel>
              <FieldDescription>
                The total credits required to complete this Program.
              </FieldDescription>
              <Input
                id={`${fieldId}-grad-credits`}
                type="number"
                step="0.5"
                value={gradCredits}
                onChange={(event) => setGradCredits(event.target.value)}
                required
              />
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
        title="LMS"
        description="Choose which saved LMS integration this Program should use."
        contentClassName="space-y-6"
      >
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-lms-integration`}>Program LMS</FieldLabel>
              <Select
                value={lmsIntegrationId}
                onValueChange={setLmsIntegrationId}
                disabled={Boolean(initialSettings?.has_lms_dependencies)}
              >
                <SelectTrigger id={`${fieldId}-lms-integration`} className="w-full">
                  <SelectValue placeholder="Select an LMS integration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__none__">No LMS</SelectItem>
                    {lmsIntegrations.map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.display_name} ({integration.provider})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {initialSettings?.has_lms_dependencies
                  ? "This Program already has LMS-linked courses. Unlink them before switching integrations."
                  : "Imports and course linking use the LMS integration selected here."}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </FieldSet>
      </SettingsSection>

      <SettingsSection
        title="Course Code Colors"
        description="Set the default color for each course code prefix in this Program. Courses can still use their own custom override when needed."
        contentClassName="space-y-5"
      >
        <DataTable
          title="Course Code Colors"
          description="Manage the default color used for each course code prefix in this Program."
          items={visibleSubjectCodes}
          emptyMessage="Subject codes appear here after courses such as APS105 or MAT180 are detected."
          minWidthClassName="min-w-[34rem] sm:min-w-[40rem]"
          getRowKey={(subjectCode) => subjectCode}
          columns={[
            {
              key: 'code',
              label: 'Code',
              fit: 'fill',
              cell: (subjectCode) => (
                <span className="font-mono text-sm font-semibold tracking-[0.08em] sm:tracking-[0.12em]">
                  {subjectCode}
                </span>
              ),
            },
            {
              key: 'color',
              label: 'Color',
              width: 120,
              cellClassName: 'py-3',
              cell: (subjectCode) => {
                const automaticColor = resolvedSubjectColorMap[subjectCode];
                const selectedColor = subjectColorMap[subjectCode] ?? automaticColor;
                return (
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
                );
              },
            },
            {
              key: 'action',
              label: 'Action',
              width: 64,
              align: 'right',
              cell: (subjectCode) => (
                <DataTableActionMenu triggerLabel={`Open actions for ${subjectCode}`}>
                  <DropdownMenuItem variant="destructive" onClick={() => setPendingResetSubjectCode(subjectCode)}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </DropdownMenuItem>
                </DataTableActionMenu>
              ),
            },
          ]}
        />
        <AlertDialog open={pendingResetSubjectCode !== null} onOpenChange={(open) => !open && setPendingResetSubjectCode(null)}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset {pendingResetSubjectCode} color?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingResetSubjectCode
                  ? `This removes the Program override and restores the automatic default color for ${pendingResetSubjectCode}.`
                  : "This removes the Program override and restores the automatic default color."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (!pendingResetSubjectCode) return;
                  setSubjectColorMap((current) => {
                    const next = { ...current };
                    delete next[pendingResetSubjectCode];
                    return next;
                  });
                  setPendingResetSubjectCode(null);
                }}
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
    </div>
  );
};
