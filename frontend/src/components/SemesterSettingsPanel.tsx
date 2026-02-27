// input:  [semester initial fields, date pickers, date-fns parse/format helpers, save callback]
// output: [`SemesterSettingsPanel` component]
// pos:    [Semester settings form for term title and date-range management with mobile-safe date range presentation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SettingsSection } from "./SettingsSection";
import { SaveSettingButton } from "./SaveSettingButton";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface SemesterSettingsPanelProps {
  initialName: string;
  initialSettings: {
    start_date?: string;
    end_date?: string;
  };
  onSave: (data: { name: string; start_date: string | null; end_date: string | null }) => Promise<void>;
}

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

export const SemesterSettingsPanel: React.FC<SemesterSettingsPanelProps> = ({
  initialName,
  initialSettings,
  onSave,
}) => {
  const isMobile = useIsMobile();
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [formError, setFormError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">("idle");
  const fieldId = useId();
  const startDateRaw = initialSettings?.start_date;
  const endDateRaw = initialSettings?.end_date;
  const dateRangeLabel = startDate
    ? endDate
      ? `${format(startDate, "PP")} - ${format(endDate, "PP")}`
      : format(startDate, "PP")
    : "Pick a date range";

  useEffect(() => {
    setName(initialName);
    setFormError("");

    const parsedStart =
      typeof startDateRaw === "string" && startDateRaw.length > 0
        ? parseISO(startDateRaw)
        : undefined;
    const parsedEnd =
      typeof endDateRaw === "string" && endDateRaw.length > 0
        ? parseISO(endDateRaw)
        : undefined;
    setStartDate(parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : undefined);
    setEndDate(parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : undefined);
  }, [initialName, startDateRaw, endDateRaw]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveState === "saving") return;

    if (startDate && endDate && startDate > endDate) {
      setFormError("Start date must be earlier than or equal to end date.");
      return;
    }

    setFormError("");
    setSaveState("saving");

    try {
      await onSave({
        name,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
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
          <Label>Semester Duration</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id={`${fieldId}-date`}
                variant="outline"
                className={cn(
                  "w-full min-w-0 justify-start overflow-hidden text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                <span className="truncate">{dateRangeLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                autoFocus
                mode="range"
                defaultMonth={startDate}
                selected={{
                  from: startDate,
                  to: endDate,
                }}
                onSelect={(range) => {
                  setStartDate(range?.from);
                  setEndDate(range?.to);
                }}
                numberOfMonths={isMobile ? 1 : 2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

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
