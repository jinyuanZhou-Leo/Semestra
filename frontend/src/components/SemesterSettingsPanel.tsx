// input:  [semester initial fields, date pickers, date-fns parse/format helpers, and auto-save callback]
// output: [`SemesterSettingsPanel` component]
// pos:    [Semester settings form for term title, semester duration, and optional Reading Week management with debounced auto-save]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SettingsSection } from "./SettingsSection";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { cn } from "@/lib/utils";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAutoSave } from "@/hooks/useAutoSave";

interface SemesterSettingsPanelProps {
  initialName: string;
  initialSettings: {
    start_date?: string;
    end_date?: string;
    reading_week_start?: string | null;
    reading_week_end?: string | null;
  };
  onSave: (data: {
    name: string;
    start_date: string | null;
    end_date: string | null;
    reading_week_start: string | null;
    reading_week_end: string | null;
  }) => Promise<void>;
}

export const SemesterSettingsPanel: React.FC<SemesterSettingsPanelProps> = ({
  initialName,
  initialSettings,
  onSave,
}) => {
  const isMobile = useIsMobile();
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [readingWeekStart, setReadingWeekStart] = useState<Date | undefined>(undefined);
  const [readingWeekEnd, setReadingWeekEnd] = useState<Date | undefined>(undefined);
  const [formError, setFormError] = useState("");
  const fieldId = useId();
  const startDateRaw = initialSettings?.start_date;
  const endDateRaw = initialSettings?.end_date;
  const readingWeekStartRaw = initialSettings?.reading_week_start;
  const readingWeekEndRaw = initialSettings?.reading_week_end;
  const dateRangeLabel = startDate
    ? endDate
      ? `${format(startDate, "PP")} - ${format(endDate, "PP")}`
      : format(startDate, "PP")
    : "Pick a date range";
  const readingWeekLabel = readingWeekStart && readingWeekEnd
    ? `${format(readingWeekStart, "PP")} - ${format(readingWeekEnd, "PP")}`
    : "Optional";

  const normalizeToDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const savedSnapshot = useMemo(
    () => ({
      name: initialName,
      startDate: startDateRaw ?? null,
      endDate: endDateRaw ?? null,
      readingWeekStart: readingWeekStartRaw ?? null,
      readingWeekEnd: readingWeekEndRaw ?? null,
    }),
    [endDateRaw, initialName, readingWeekEndRaw, readingWeekStartRaw, startDateRaw]
  );
  const draftSnapshot = useMemo(
    () => ({
      name,
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : null,
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : null,
      readingWeekStart: readingWeekStart ? format(readingWeekStart, "yyyy-MM-dd") : null,
      readingWeekEnd: readingWeekEnd ? format(readingWeekEnd, "yyyy-MM-dd") : null,
    }),
    [endDate, name, readingWeekEnd, readingWeekStart, startDate]
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);

  const isReadingWeekDateDisabled = (day: Date) => {
    if (!startDate || !endDate) return false;
    const monday = startOfWeek(day, { weekStartsOn: 1 });
    const sunday = addDays(monday, 6);
    return normalizeToDay(monday) < normalizeToDay(startDate) || normalizeToDay(sunday) > normalizeToDay(endDate);
  };

  useEffect(() => {
    const previousSnapshot = lastLoadedSnapshotRef.current;
    const externalChanged =
      previousSnapshot.name !== savedSnapshot.name ||
      previousSnapshot.startDate !== savedSnapshot.startDate ||
      previousSnapshot.endDate !== savedSnapshot.endDate ||
      previousSnapshot.readingWeekStart !== savedSnapshot.readingWeekStart ||
      previousSnapshot.readingWeekEnd !== savedSnapshot.readingWeekEnd;
    const draftHasLocalChanges =
      previousSnapshot.name !== draftSnapshot.name ||
      previousSnapshot.startDate !== draftSnapshot.startDate ||
      previousSnapshot.endDate !== draftSnapshot.endDate ||
      previousSnapshot.readingWeekStart !== draftSnapshot.readingWeekStart ||
      previousSnapshot.readingWeekEnd !== draftSnapshot.readingWeekEnd;
    const incomingMatchesDraft =
      savedSnapshot.name === draftSnapshot.name &&
      savedSnapshot.startDate === draftSnapshot.startDate &&
      savedSnapshot.endDate === draftSnapshot.endDate &&
      savedSnapshot.readingWeekStart === draftSnapshot.readingWeekStart &&
      savedSnapshot.readingWeekEnd === draftSnapshot.readingWeekEnd;

    lastLoadedSnapshotRef.current = savedSnapshot;
    if (!externalChanged) return;
    if (draftHasLocalChanges && !incomingMatchesDraft) return;

    setName(savedSnapshot.name);
    setFormError("");

    const parsedStart =
      typeof savedSnapshot.startDate === "string" && savedSnapshot.startDate.length > 0
        ? parseISO(savedSnapshot.startDate)
        : undefined;
    const parsedEnd =
      typeof savedSnapshot.endDate === "string" && savedSnapshot.endDate.length > 0
        ? parseISO(savedSnapshot.endDate)
        : undefined;
    const parsedReadingWeekStart =
      typeof savedSnapshot.readingWeekStart === "string" && savedSnapshot.readingWeekStart.length > 0
        ? parseISO(savedSnapshot.readingWeekStart)
        : undefined;
    const parsedReadingWeekEnd =
      typeof savedSnapshot.readingWeekEnd === "string" && savedSnapshot.readingWeekEnd.length > 0
        ? parseISO(savedSnapshot.readingWeekEnd)
        : undefined;
    setStartDate(parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : undefined);
    setEndDate(parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : undefined);
    setReadingWeekStart(
      parsedReadingWeekStart && !Number.isNaN(parsedReadingWeekStart.getTime())
        ? parsedReadingWeekStart
        : undefined
    );
    setReadingWeekEnd(
      parsedReadingWeekEnd && !Number.isNaN(parsedReadingWeekEnd.getTime())
        ? parsedReadingWeekEnd
        : undefined
    );
  }, [draftSnapshot, savedSnapshot]);

  const isValid = useMemo(() => {
    if (startDate && endDate && startDate > endDate) {
      return false;
    }

    if ((readingWeekStart && !readingWeekEnd) || (!readingWeekStart && readingWeekEnd)) {
      return false;
    }

    if (readingWeekStart && readingWeekEnd) {
      if (!startDate || !endDate) {
        return false;
      }

      if (differenceInCalendarDays(readingWeekEnd, readingWeekStart) !== 6) {
        return false;
      }

      if (readingWeekStart.getDay() !== 1 || readingWeekEnd.getDay() !== 0) {
        return false;
      }

      if (
        normalizeToDay(readingWeekStart) < normalizeToDay(startDate)
        || normalizeToDay(readingWeekEnd) > normalizeToDay(endDate)
      ) {
        return false;
      }
    }

    return true;
  }, [endDate, readingWeekEnd, readingWeekStart, startDate]);

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) {
      setFormError("Start date must be earlier than or equal to end date.");
      return;
    }

    if ((readingWeekStart && !readingWeekEnd) || (!readingWeekStart && readingWeekEnd)) {
      setFormError("Reading Week must include both a start and end date.");
      return;
    }

    if (readingWeekStart && readingWeekEnd) {
      if (!startDate || !endDate) {
        setFormError("Set the semester duration before selecting Reading Week.");
        return;
      }

      if (differenceInCalendarDays(readingWeekEnd, readingWeekStart) !== 6) {
        setFormError("Reading Week must span exactly one Monday-to-Sunday week.");
        return;
      }

      if (readingWeekStart.getDay() !== 1 || readingWeekEnd.getDay() !== 0) {
        setFormError("Reading Week must start on Monday and end on Sunday.");
        return;
      }

      if (
        normalizeToDay(readingWeekStart) < normalizeToDay(startDate)
        || normalizeToDay(readingWeekEnd) > normalizeToDay(endDate)
      ) {
        setFormError("Reading Week must stay within the semester duration.");
        return;
      }
    }

    setFormError("");
  }, [endDate, readingWeekEnd, readingWeekStart, startDate]);

  const { saveState, hasPendingChanges } = useAutoSave({
    value: draftSnapshot,
    savedValue: savedSnapshot,
    validate: () => isValid,
    onSave: async (snapshot) => {
      await onSave({
        name: snapshot.name,
        start_date: snapshot.startDate,
        end_date: snapshot.endDate,
        reading_week_start: snapshot.readingWeekStart,
        reading_week_end: snapshot.readingWeekEnd,
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
          <Label>Semester Duration</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id={`${fieldId}-date`}
                type="button"
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

        <div className="grid gap-2 max-w-sm">
          <div className="space-y-1">
            <Label>Reading Week</Label>
            <p className="text-sm text-muted-foreground">
              Optional. Pick any day and Semestra will store the full Monday-to-Sunday week.
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id={`${fieldId}-reading-week`}
                type="button"
                variant="outline"
                className={cn(
                  "w-full min-w-0 justify-start overflow-hidden text-left font-normal",
                  !readingWeekStart && "text-muted-foreground"
                )}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                <span className="truncate">{readingWeekLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                autoFocus
                mode="range"
                defaultMonth={readingWeekStart ?? startDate}
                selected={{
                  from: readingWeekStart,
                  to: readingWeekEnd,
                }}
                onDayClick={(day, modifiers) => {
                  if (modifiers.disabled) return;
                  const monday = startOfWeek(day, { weekStartsOn: 1 });
                  setReadingWeekStart(monday);
                  setReadingWeekEnd(addDays(monday, 6));
                }}
                disabled={isReadingWeekDateDisabled}
                numberOfMonths={isMobile ? 1 : 2}
              />
              <div className="flex justify-end border-t px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReadingWeekStart(undefined);
                    setReadingWeekEnd(undefined);
                  }}
                  disabled={!readingWeekStart && !readingWeekEnd}
                >
                  Clear Reading Week
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <div className="flex items-center justify-end">
          <AutoSaveStatus
            saveState={saveState}
            hasPendingChanges={hasPendingChanges}
            isValid={isValid}
          />
        </div>
      </div>
    </SettingsSection>
  );
};
