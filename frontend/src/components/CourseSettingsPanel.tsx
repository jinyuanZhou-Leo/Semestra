// input:  [initial course fields (name/alias/category/credits/GPA flags) and auto-save callback]
// output: [`CourseSettingsPanel` component]
// pos:    [Settings form section for editing per-course metadata and GPA participation with debounced auto-save]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SettingsSection } from "./SettingsSection";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { useAutoSave } from "@/hooks/useAutoSave";

interface CourseSettingsPanelProps {
  initialName: string;
  initialSettings: {
    alias?: string;
    category?: string;
    credits?: number;
    include_in_gpa?: boolean;
    hide_gpa?: boolean;
  };
  onSave: (data: {
    name: string;
    alias: string | null;
    category: string | null;
    credits: number;
    include_in_gpa: boolean;
    hide_gpa: boolean;
  }) => Promise<void>;
}

export const CourseSettingsPanel: React.FC<CourseSettingsPanelProps> = ({
  initialName,
  initialSettings,
  onSave,
}) => {
  const [name, setName] = useState(initialName);
  const [alias, setAlias] = useState(initialSettings?.alias || "");
  const [category, setCategory] = useState(initialSettings?.category || "");
  const [credits, setCredits] = useState(String(initialSettings?.credits || ""));
  const [includeInGpa, setIncludeInGpa] = useState(initialSettings?.include_in_gpa ?? true);
  const [hideGpa, setHideGpa] = useState(initialSettings?.hide_gpa ?? false);
  const fieldId = useId();
  const initialAlias = initialSettings?.alias || "";
  const initialCategory = initialSettings?.category || "";
  const initialCredits = String(initialSettings?.credits || "");
  const initialIncludeInGpa = initialSettings?.include_in_gpa ?? true;
  const initialHideGpa = initialSettings?.hide_gpa ?? false;
  const savedSnapshot = useMemo(
    () => ({
      name: initialName,
      alias: initialAlias,
      category: initialCategory,
      credits: initialCredits,
      includeInGpa: initialIncludeInGpa,
      hideGpa: initialHideGpa,
    }),
    [
      initialAlias,
      initialCategory,
      initialCredits,
      initialHideGpa,
      initialIncludeInGpa,
      initialName,
    ]
  );
  const draftSnapshot = useMemo(
    () => ({
      name,
      alias,
      category,
      credits,
      includeInGpa,
      hideGpa,
    }),
    [alias, category, credits, hideGpa, includeInGpa, name]
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);

  useEffect(() => {
    const previousSnapshot = lastLoadedSnapshotRef.current;
    const externalChanged =
      previousSnapshot.name !== savedSnapshot.name ||
      previousSnapshot.alias !== savedSnapshot.alias ||
      previousSnapshot.category !== savedSnapshot.category ||
      previousSnapshot.credits !== savedSnapshot.credits ||
      previousSnapshot.includeInGpa !== savedSnapshot.includeInGpa ||
      previousSnapshot.hideGpa !== savedSnapshot.hideGpa;
    const draftHasLocalChanges =
      previousSnapshot.name !== draftSnapshot.name ||
      previousSnapshot.alias !== draftSnapshot.alias ||
      previousSnapshot.category !== draftSnapshot.category ||
      previousSnapshot.credits !== draftSnapshot.credits ||
      previousSnapshot.includeInGpa !== draftSnapshot.includeInGpa ||
      previousSnapshot.hideGpa !== draftSnapshot.hideGpa;
    const incomingMatchesDraft =
      savedSnapshot.name === draftSnapshot.name &&
      savedSnapshot.alias === draftSnapshot.alias &&
      savedSnapshot.category === draftSnapshot.category &&
      savedSnapshot.credits === draftSnapshot.credits &&
      savedSnapshot.includeInGpa === draftSnapshot.includeInGpa &&
      savedSnapshot.hideGpa === draftSnapshot.hideGpa;

    lastLoadedSnapshotRef.current = savedSnapshot;
    if (!externalChanged) return;
    if (draftHasLocalChanges && !incomingMatchesDraft) return;

    setName(savedSnapshot.name);
    setAlias(savedSnapshot.alias);
    setCategory(savedSnapshot.category);
    setCredits(savedSnapshot.credits);
    setIncludeInGpa(savedSnapshot.includeInGpa);
    setHideGpa(savedSnapshot.hideGpa);
  }, [draftSnapshot, savedSnapshot]);

  const { saveState, hasPendingChanges } = useAutoSave({
    value: draftSnapshot,
    savedValue: savedSnapshot,
    onSave: async (snapshot) => {
      await onSave({
        name: snapshot.name,
        alias: snapshot.alias || null,
        category: snapshot.category || null,
        credits: parseFloat(snapshot.credits) || 0,
        include_in_gpa: snapshot.includeInGpa,
        hide_gpa: snapshot.hideGpa,
      });
    },
    onError: (error) => {
      console.error("Failed to save settings", error);
    },
  });

  return (
    <SettingsSection title="General" description="Update the name and key settings.">
      <div className="grid gap-6">
        <div className="grid gap-2 max-w-sm">
          <Label htmlFor={`${fieldId}-name`}>Name</Label>
          <Input
            id={`${fieldId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-2 max-w-sm pt-2">
          <Label htmlFor={`${fieldId}-alias`}>Alias (optional)</Label>
          <Input
            id={`${fieldId}-alias`}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g. CS101 - Prof. Smith"
          />
        </div>

        <div className="grid gap-2 max-w-sm pt-2">
          <Label htmlFor={`${fieldId}-category`}>Category (optional)</Label>
          <Input
            id={`${fieldId}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. CS"
          />
        </div>

        <div className="grid gap-2 max-w-sm pt-2">
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

        <div className="flex items-center justify-end">
          <AutoSaveStatus
            saveState={saveState}
            hasPendingChanges={hasPendingChanges}
          />
        </div>
      </div>
    </SettingsSection>
  );
};
