// input:  [initial course fields (name/alias/category/custom color/credits/GPA flags), resolved Program default color metadata, color picker UI, and auto-save callback]
// output: [`CourseSettingsPanel` component]
// pos:    [Settings form section for editing per-course metadata, a stable-layout optional custom color override, and GPA participation with debounced auto-save]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker, type ColorPickerPreset } from "@/components/ui/color-picker";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "./SettingsSection";
import { useAutoSave } from "@/hooks/useAutoSave";
import { cn } from "@/lib/utils";
import { normalizeSubjectCode, resolveCourseSubjectCode } from "@/utils/courseCategoryBadge";

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
    <SettingsSection title="General" description="Update the name and key settings.">
      <div className="grid gap-6">
        <div className="grid max-w-sm gap-2">
          <Label htmlFor={`${fieldId}-name`}>Name</Label>
          <Input
            id={`${fieldId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid max-w-sm gap-2 pt-2">
          <Label htmlFor={`${fieldId}-alias`}>Alias (optional)</Label>
          <Input
            id={`${fieldId}-alias`}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g. CS101 - Prof. Smith"
          />
        </div>

        <div className="grid max-w-sm gap-2 pt-2">
          <div className="flex min-h-9 items-center justify-between gap-3">
            <Label htmlFor={`${fieldId}-category`}>Category (optional)</Label>
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
        </div>

        <div className="grid gap-4 pt-2">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Course Color
            </Label>
            <div className="flex min-h-11 items-center gap-3">
              <Switch
                id={`${fieldId}-custom-color`}
                checked={useCustomColor}
                onCheckedChange={setUseCustomColor}
              />
              <Label htmlFor={`${fieldId}-custom-color`} className="text-sm text-muted-foreground">
                Use custom override
              </Label>
            </div>
          </div>

          <div className="grid max-w-sm gap-2">
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
          </div>
        </div>

        <div className="grid max-w-sm gap-2 pt-2">
          <Label htmlFor={`${fieldId}-credits`}>Credits</Label>
          <Input
            id={`${fieldId}-credits`}
            type="number"
            step="0.5"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Checkbox
              id={`${fieldId}-include-gpa`}
              checked={includeInGpa}
              onCheckedChange={(checked) => {
                if (checked === "indeterminate") return;
                setIncludeInGpa(checked);
              }}
            />
            <Label htmlFor={`${fieldId}-include-gpa`} className="text-sm text-muted-foreground">
              Include in GPA
            </Label>
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
        </div>
      </div>
    </SettingsSection>
  );
};
