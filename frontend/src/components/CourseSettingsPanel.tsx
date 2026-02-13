import React, { useEffect, useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SettingsSection } from "./SettingsSection";
import { SaveSettingButton } from "./SaveSettingButton";

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

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">("idle");
  const fieldId = useId();
  const initialAlias = initialSettings?.alias || "";
  const initialCategory = initialSettings?.category || "";
  const initialCredits = String(initialSettings?.credits || "");
  const initialIncludeInGpa = initialSettings?.include_in_gpa ?? true;
  const initialHideGpa = initialSettings?.hide_gpa ?? false;

  useEffect(() => {
    setName(initialName);
    setAlias(initialAlias);
    setCategory(initialCategory);
    setCredits(initialCredits);
    setIncludeInGpa(initialIncludeInGpa);
    setHideGpa(initialHideGpa);
  }, [initialName, initialAlias, initialCategory, initialCredits, initialIncludeInGpa, initialHideGpa]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveState === "saving") return;

    setSaveState("saving");

    try {
      await onSave({
        name,
        alias: alias || null,
        category: category || null,
        credits: parseFloat(credits) || 0,
        include_in_gpa: includeInGpa,
        hide_gpa: hideGpa,
      });
      setSaveState("success");
      await wait(700);
      setSaveState("idle");
    } catch (error) {
      console.error("Failed to save settings", error);
      setSaveState("idle");
    }
  };

  return (
    <SettingsSection title="General" description="Update the name and key settings.">
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
          <SaveSettingButton
            type="submit"
            label="Save Settings"
            saveState={saveState}
            animated
          />
        </div>
      </form>
    </SettingsSection>
  );
};
