// input:  [initial course fields (name/alias/category/custom color/credits/GPA flags), resolved Program default color metadata, LMS link state and available LMS courses, color picker UI, and auto-save callback]
// output: [`CourseSettingsPanel` component]
// pos:    [Settings form section for editing per-course metadata, LMS link/sync actions, a stable-layout optional custom color override, GPA participation, and shadcn Field-based form structure with debounced auto-save]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker, type ColorPickerPreset } from "@/components/ui/color-picker";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SettingsSection } from "./SettingsSection";
import { useAutoSave } from "@/hooks/useAutoSave";
import { cn } from "@/lib/utils";
import { normalizeSubjectCode, resolveCourseSubjectCode } from "@/utils/courseCategoryBadge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import type { LmsCourseLinkSummary, LmsCourseSummary } from "@/services/api";

const COURSE_COLOR_PRESETS: readonly ColorPickerPreset[] = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Amber', value: '#ca8a04' },
  { name: 'Sky', value: '#0ea5e9' },
];

interface CourseSettingsPanelProps {
  initialName: string;
  initialSettings: {
    alias?: string;
    category?: string;
    color?: string | null;
    credits?: number;
    include_in_gpa?: boolean;
    hide_gpa?: boolean;
  };
  resolvedDefaultColor?: string | null;
  lmsLink?: LmsCourseLinkSummary | null;
  lmsIntegrationEnabled?: boolean;
  availableLmsCourses?: LmsCourseSummary[];
  onLinkCourse?: (data: { external_course_id: string; sync_enabled: boolean }) => Promise<void>;
  onSyncCourseLink?: (data?: { sync_enabled?: boolean }) => Promise<void>;
  onUnlinkCourse?: () => Promise<void>;
  onSave: (data: {
    name: string;
    alias: string | null;
    category: string | null;
    color: string | null;
    credits: number;
    include_in_gpa: boolean;
    hide_gpa: boolean;
  }) => Promise<void>;
  registerFlush?: (flush: () => Promise<void>) => void;
}

export const CourseSettingsPanel: React.FC<CourseSettingsPanelProps> = ({
  initialName,
  initialSettings,
  resolvedDefaultColor,
  lmsLink = null,
  lmsIntegrationEnabled = false,
  availableLmsCourses = [],
  onLinkCourse,
  onSyncCourseLink,
  onUnlinkCourse,
  onSave,
  registerFlush,
}) => {
  const automaticColor = resolvedDefaultColor || "#3b82f6";
  const [name, setName] = useState(initialName);
  const [alias, setAlias] = useState(initialSettings?.alias || "");
  const [category, setCategory] = useState(initialSettings?.category || "");
  const [useCustomColor, setUseCustomColor] = useState(Boolean(initialSettings?.color));
  const [color, setColor] = useState(initialSettings?.color || automaticColor);
  const [credits, setCredits] = useState(String(initialSettings?.credits || ""));
  const [includeInGpa, setIncludeInGpa] = useState(initialSettings?.include_in_gpa ?? true);
  const [hideGpa, setHideGpa] = useState(initialSettings?.hide_gpa ?? false);
  const [selectedLmsCourseId, setSelectedLmsCourseId] = useState(lmsLink?.external_course_id ?? "");
  const [lmsSyncEnabled, setLmsSyncEnabled] = useState(lmsLink?.sync_enabled ?? true);
  const [isLmsBusy, setIsLmsBusy] = useState(false);
  const fieldId = useId();
  const initialAlias = initialSettings?.alias || "";
  const initialCategory = initialSettings?.category || "";
  const initialColor = initialSettings?.color || automaticColor;
  const initialUseCustomColor = Boolean(initialSettings?.color);
  const initialCredits = String(initialSettings?.credits || "");
  const initialIncludeInGpa = initialSettings?.include_in_gpa ?? true;
  const initialHideGpa = initialSettings?.hide_gpa ?? false;
  const savedSnapshot = useMemo(
    () => ({
      name: initialName,
      alias: initialAlias,
      category: initialCategory,
      useCustomColor: initialUseCustomColor,
      color: initialColor,
      credits: initialCredits,
      includeInGpa: initialIncludeInGpa,
      hideGpa: initialHideGpa,
    }),
    [
      initialAlias,
      initialCategory,
      initialColor,
      initialCredits,
      initialHideGpa,
      initialIncludeInGpa,
      initialName,
      initialUseCustomColor,
    ]
  );
  const draftSnapshot = useMemo(
    () => ({
      name,
      alias,
      category,
      useCustomColor,
      color,
      credits,
      includeInGpa,
      hideGpa,
    }),
    [alias, category, color, credits, hideGpa, includeInGpa, name, useCustomColor]
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);

  useEffect(() => {
    const previousSnapshot = lastLoadedSnapshotRef.current;
    const externalChanged =
      previousSnapshot.name !== savedSnapshot.name ||
      previousSnapshot.alias !== savedSnapshot.alias ||
      previousSnapshot.category !== savedSnapshot.category ||
      previousSnapshot.useCustomColor !== savedSnapshot.useCustomColor ||
      previousSnapshot.color !== savedSnapshot.color ||
      previousSnapshot.credits !== savedSnapshot.credits ||
      previousSnapshot.includeInGpa !== savedSnapshot.includeInGpa ||
      previousSnapshot.hideGpa !== savedSnapshot.hideGpa;
    const draftHasLocalChanges =
      previousSnapshot.name !== draftSnapshot.name ||
      previousSnapshot.alias !== draftSnapshot.alias ||
      previousSnapshot.category !== draftSnapshot.category ||
      previousSnapshot.useCustomColor !== draftSnapshot.useCustomColor ||
      previousSnapshot.color !== draftSnapshot.color ||
      previousSnapshot.credits !== draftSnapshot.credits ||
      previousSnapshot.includeInGpa !== draftSnapshot.includeInGpa ||
      previousSnapshot.hideGpa !== draftSnapshot.hideGpa;
    const incomingMatchesDraft =
      savedSnapshot.name === draftSnapshot.name &&
      savedSnapshot.alias === draftSnapshot.alias &&
      savedSnapshot.category === draftSnapshot.category &&
      savedSnapshot.useCustomColor === draftSnapshot.useCustomColor &&
      savedSnapshot.color === draftSnapshot.color &&
      savedSnapshot.credits === draftSnapshot.credits &&
      savedSnapshot.includeInGpa === draftSnapshot.includeInGpa &&
      savedSnapshot.hideGpa === draftSnapshot.hideGpa;

    lastLoadedSnapshotRef.current = savedSnapshot;
    if (!externalChanged) return;
    if (draftHasLocalChanges && !incomingMatchesDraft) return;

    setName(savedSnapshot.name);
    setAlias(savedSnapshot.alias);
    setCategory(savedSnapshot.category);
    setUseCustomColor(savedSnapshot.useCustomColor);
    setColor(savedSnapshot.color);
    setCredits(savedSnapshot.credits);
    setIncludeInGpa(savedSnapshot.includeInGpa);
    setHideGpa(savedSnapshot.hideGpa);
  }, [draftSnapshot, savedSnapshot]);

  useEffect(() => {
    if (useCustomColor) return;
    setColor(automaticColor);
  }, [automaticColor, useCustomColor]);

  useEffect(() => {
    setSelectedLmsCourseId(lmsLink?.external_course_id ?? "");
    setLmsSyncEnabled(lmsLink?.sync_enabled ?? true);
  }, [lmsLink?.external_course_id, lmsLink?.sync_enabled]);

  const { flush } = useAutoSave({
    value: draftSnapshot,
    savedValue: savedSnapshot,
    onSave: async (snapshot) => {
      await onSave({
        name: snapshot.name,
        alias: snapshot.alias || null,
        category: snapshot.category || null,
        color: snapshot.useCustomColor ? snapshot.color : null,
        credits: parseFloat(snapshot.credits) || 0,
        include_in_gpa: snapshot.includeInGpa,
        hide_gpa: snapshot.hideGpa,
      });
    },
    onError: (error) => {
      console.error("Failed to save settings", error);
    },
  });

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

  const suggestedCategory = useMemo(
    () => resolveCourseSubjectCode({ name, alias: "", category: "" }),
    [name],
  );
  const normalizedCurrentCategory = useMemo(
    () => normalizeSubjectCode(category),
    [category],
  );
  const shouldShowCategoryUpdate = Boolean(
    suggestedCategory && suggestedCategory !== normalizedCurrentCategory,
  );

  return (
    <div className="space-y-6">
      <SettingsSection title="General" description="Update the name and key settings.">
        <FieldSet>
          <FieldGroup>
          <Field className="max-w-sm">
            <FieldLabel htmlFor={`${fieldId}-name`}>Name</FieldLabel>
            <Input
              id={`${fieldId}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field className="max-w-sm">
            <FieldLabel htmlFor={`${fieldId}-alias`}>Alias</FieldLabel>
            <Input
              id={`${fieldId}-alias`}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. CS101 - Prof. Smith"
            />
            <FieldDescription>Optional short label shown alongside the course name.</FieldDescription>
          </Field>

          <Field className="max-w-sm">
            <div className="flex min-h-9 items-center justify-between gap-3">
              <FieldLabel htmlFor={`${fieldId}-category`}>Category</FieldLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "transition-opacity",
                  !shouldShowCategoryUpdate && "pointer-events-none opacity-0",
                )}
                onClick={() => {
                  if (!suggestedCategory) return;
                  setCategory(suggestedCategory);
                }}
                aria-hidden={!shouldShowCategoryUpdate}
                tabIndex={shouldShowCategoryUpdate ? 0 : -1}
              >
                Update to {suggestedCategory || "CODE"}
              </Button>
            </div>
            <Input
              id={`${fieldId}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. APS"
            />
            <FieldDescription>Optional subject code used for grouping and default colors.</FieldDescription>
          </Field>

          <FieldGroup>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-custom-color`}>Course Color</FieldLabel>
                <FieldDescription>Use a per-course color override instead of the Program default.</FieldDescription>
              </FieldContent>
              <Switch
                id={`${fieldId}-custom-color`}
                checked={useCustomColor}
                onCheckedChange={setUseCustomColor}
                className="shrink-0"
              />
            </Field>

            <Field className="max-w-sm">
              <div className={cn("transition-opacity", !useCustomColor && "pointer-events-none opacity-55")}>
                <ColorPicker
                  id={`${fieldId}-color`}
                  value={color}
                  onChange={(nextColor) => {
                    setColor(nextColor);
                    setUseCustomColor(true);
                  }}
                  defaultColor={automaticColor}
                  presetColors={COURSE_COLOR_PRESETS}
                  triggerAriaLabel="Choose custom course color"
                  resetLabel="Use Program default color"
                />
              </div>
            </Field>
          </FieldGroup>

          <Field className="max-w-sm">
            <FieldLabel htmlFor={`${fieldId}-credits`}>Credits</FieldLabel>
            <Input
              id={`${fieldId}-credits`}
              type="number"
              step="0.5"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              required
            />
          </Field>

          <FieldGroup className="sm:grid sm:grid-cols-2">
            <Field orientation="horizontal">
              <Checkbox
                id={`${fieldId}-include-gpa`}
                checked={includeInGpa}
                onCheckedChange={(checked) => {
                  if (checked === "indeterminate") return;
                  setIncludeInGpa(checked);
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-include-gpa`}>Include in GPA</FieldLabel>
                <FieldDescription>Use this course when calculating GPA.</FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id={`${fieldId}-hide-gpa`}
                checked={hideGpa}
                onCheckedChange={(checked) => {
                  if (checked === "indeterminate") return;
                  setHideGpa(checked);
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-hide-gpa`}>Hide GPA Info</FieldLabel>
                <FieldDescription>Hide GPA details in course-level views.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
          </FieldGroup>
        </FieldSet>
      </SettingsSection>

      <SettingsSection title="LMS" description="Link this course to an external LMS course and refresh its read-only LMS data.">
        <FieldSet>
          <FieldGroup>
            <Field className="max-w-sm">
              <FieldLabel htmlFor={`${fieldId}-lms-course`}>Linked LMS Course</FieldLabel>
              <NativeSelect
                id={`${fieldId}-lms-course`}
                className="w-full"
                value={selectedLmsCourseId || "__none__"}
                onChange={(event) => setSelectedLmsCourseId(event.target.value === "__none__" ? "" : event.target.value)}
                disabled={!lmsIntegrationEnabled || availableLmsCourses.length === 0 || isLmsBusy}
              >
                <NativeSelectOption value="__none__">Select an LMS course</NativeSelectOption>
                {availableLmsCourses.map((courseOption) => (
                  <NativeSelectOption key={courseOption.external_id} value={courseOption.external_id}>
                    {courseOption.name}{courseOption.course_code ? ` (${courseOption.course_code})` : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                {!lmsIntegrationEnabled
                  ? "Configure an LMS integration on the Program before linking courses."
                  : "Linking keeps LMS assignments and calendar events available without changing your local course data."}
              </FieldDescription>
            </Field>

            <Field orientation="responsive" className="max-w-sm">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-lms-sync-enabled`}>LMS Sync Enabled</FieldLabel>
                <FieldDescription>
                  Disable this if you want to keep the link but stop LMS refreshes for this course.
                </FieldDescription>
              </FieldContent>
              <Switch
                id={`${fieldId}-lms-sync-enabled`}
                checked={lmsSyncEnabled}
                onCheckedChange={setLmsSyncEnabled}
                disabled={isLmsBusy || (!lmsLink && !selectedLmsCourseId)}
              />
            </Field>

            <Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedLmsCourseId || !onLinkCourse || isLmsBusy}
                  onClick={async () => {
                    if (!selectedLmsCourseId || !onLinkCourse) return;
                    setIsLmsBusy(true);
                    try {
                      await onLinkCourse({
                        external_course_id: selectedLmsCourseId,
                        sync_enabled: lmsSyncEnabled,
                      });
                    } finally {
                      setIsLmsBusy(false);
                    }
                  }}
                >
                  {lmsLink ? 'Relink LMS Course' : 'Link LMS Course'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!lmsLink || !onSyncCourseLink || isLmsBusy}
                  onClick={async () => {
                    if (!onSyncCourseLink) return;
                    setIsLmsBusy(true);
                    try {
                      await onSyncCourseLink({ sync_enabled: lmsSyncEnabled });
                    } finally {
                      setIsLmsBusy(false);
                    }
                  }}
                >
                  Sync Now
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!lmsLink || !onUnlinkCourse || isLmsBusy}
                  onClick={async () => {
                    if (!onUnlinkCourse) return;
                    setIsLmsBusy(true);
                    try {
                      await onUnlinkCourse();
                    } finally {
                      setIsLmsBusy(false);
                    }
                  }}
                >
                  Unlink
                </Button>
              </div>
            </Field>

            {lmsLink ? (
              <Field className="max-w-xl">
                <FieldDescription>
                  {lmsLink.integration_display_name} · {lmsLink.external_name || lmsLink.external_course_id}
                  {lmsLink.last_synced_at ? ` · Last synced ${new Date(lmsLink.last_synced_at).toLocaleString()}` : ""}
                  {lmsLink.last_error?.message ? ` · ${lmsLink.last_error.message}` : ""}
                </FieldDescription>
              </Field>
            ) : null}
          </FieldGroup>
        </FieldSet>
      </SettingsSection>
    </div>
  );
};
