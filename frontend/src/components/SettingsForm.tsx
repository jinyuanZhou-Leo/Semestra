import React, { useEffect, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GPAScalingTable } from "./GPAScalingTable";
import { SaveSettingButton } from "./SaveSettingButton";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

interface SettingsFormProps {
  initialName: string;
  initialSettings?: any;
  onSave: (data: any) => Promise<void>;
  onSuccess?: () => void | Promise<void>;
  type: "program" | "semester" | "course";
  submitLabel?: string;
  animateSubmitButton?: boolean;
  showCancel?: boolean;
  onCancel?: () => void;
}

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

export const SettingsForm: React.FC<SettingsFormProps> = ({
  initialName,
  initialSettings = {},
  onSave,
  onSuccess,
  type,
  submitLabel = "Save Changes",
  animateSubmitButton = true,
  showCancel = false,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const [alias, setAlias] = useState(initialSettings?.alias || "");
  const [category, setCategory] = useState(initialSettings?.category || "");
  const [extraSettings, setExtraSettings] = useState(initialSettings);
  const [jsonError, setJsonError] = useState("");
  const [formError, setFormError] = useState("");
  const [gpaTableJson, setGpaTableJson] = useState("{}");
  const [semesterStartDate, setSemesterStartDate] = useState<Date | undefined>(undefined);
  const [semesterEndDate, setSemesterEndDate] = useState<Date | undefined>(undefined);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">(
    "idle"
  );
  const fieldId = useId();

  const settingsKey = useMemo(
    () => JSON.stringify(initialSettings ?? {}),
    [initialSettings]
  );

  useEffect(() => {
    setName(initialName);
    setAlias(initialSettings?.alias || "");
    setCategory(initialSettings?.category || "");
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
    setFormError("");

    const startDateRaw = initialSettings?.start_date;
    const endDateRaw = initialSettings?.end_date;
    const parsedStartDate =
      typeof startDateRaw === "string" && startDateRaw.length > 0 ? parseISO(startDateRaw) : undefined;
    const parsedEndDate =
      typeof endDateRaw === "string" && endDateRaw.length > 0 ? parseISO(endDateRaw) : undefined;
    setSemesterStartDate(parsedStartDate && !Number.isNaN(parsedStartDate.getTime()) ? parsedStartDate : undefined);
    setSemesterEndDate(parsedEndDate && !Number.isNaN(parsedEndDate.getTime()) ? parsedEndDate : undefined);
  }, [initialName, settingsKey, type]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveState === "saving") return;

    if (type === "program") {
      try {
        JSON.parse(gpaTableJson);
        setJsonError("");
      } catch {
        setJsonError("Invalid JSON for GPA Table");
        return;
      }
    }
    setFormError("");

    if (type === "semester" && semesterStartDate && semesterEndDate && semesterStartDate > semesterEndDate) {
      setFormError("Start date must be earlier than or equal to end date.");
      return;
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
      data.category = category || null;
      data.credits = parseFloat(extraSettings.credits || 0);
      data.include_in_gpa = extraSettings.include_in_gpa;
      data.hide_gpa = extraSettings.hide_gpa;
    }

    if (type === "program") {
      data.gpa_scaling_table = gpaTableJson;
    }
    if (type === "semester") {
      data.start_date = semesterStartDate ? format(semesterStartDate, "yyyy-MM-dd") : null;
      data.end_date = semesterEndDate ? format(semesterEndDate, "yyyy-MM-dd") : null;
    }

    setSaveState("saving");

    try {
      await onSave(data);
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

  const hideGpaId = `${fieldId}-hide-gpa`;
  const includeGpaId = `${fieldId}-include-gpa`;
  const hideGpaCourseId = `${fieldId}-course-hide-gpa`;

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
          <div className="flex items-center gap-3">
            <Checkbox
              id={hideGpaId}
              checked={extraSettings.hide_gpa ?? false}
              onCheckedChange={(checked) => {
                if (checked === "indeterminate") return;
                setExtraSettings({ ...extraSettings, hide_gpa: checked });
              }}
            />
            <Label htmlFor={hideGpaId} className="text-sm text-muted-foreground">
              Hide GPA Info
            </Label>
          </div>
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
              value={extraSettings.credits || ""}
              onChange={(e) =>
                setExtraSettings({ ...extraSettings, credits: e.target.value })
              }
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id={includeGpaId}
                checked={extraSettings.include_in_gpa ?? true}
                onCheckedChange={(checked) => {
                  if (checked === "indeterminate") return;
                  setExtraSettings({ ...extraSettings, include_in_gpa: checked });
                }}
              />
              <Label htmlFor={includeGpaId} className="text-sm text-muted-foreground">
                Include in GPA
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id={hideGpaCourseId}
                checked={extraSettings.hide_gpa ?? false}
                onCheckedChange={(checked) => {
                  if (checked === "indeterminate") return;
                  setExtraSettings({ ...extraSettings, hide_gpa: checked });
                }}
              />
              <Label htmlFor={hideGpaCourseId} className="text-sm text-muted-foreground">
                Hide GPA Info
              </Label>
            </div>
          </div>
        </div>
      )}

      {type === "semester" && (
        <div className="grid gap-2">
          <Label>Semester Duration</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !semesterStartDate && "text-muted-foreground"
                )}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {semesterStartDate ? (
                  semesterEndDate ? (
                    <>
                      {format(semesterStartDate, "PPP")} -{" "}
                      {format(semesterEndDate, "PPP")}
                    </>
                  ) : (
                    format(semesterStartDate, "PPP")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                autoFocus
                mode="range"
                defaultMonth={semesterStartDate}
                selected={{
                  from: semesterStartDate,
                  to: semesterEndDate,
                }}
                onSelect={(range) => {
                  setSemesterStartDate(range?.from);
                  setSemesterEndDate(range?.to);
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
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
      {formError && <p className="text-sm text-destructive">{formError}</p>}

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
          label={submitLabel}
          saveState={saveState}
          animated={animateSubmitButton}
        />
      </div>
    </form>
  );
};
