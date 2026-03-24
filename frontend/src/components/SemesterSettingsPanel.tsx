// input:  [semester initial fields, date pickers, date-fns parse/format helpers, and auto-save callback]
// output: [`SemesterSettingsPanel` component]
// pos:    [Semester settings form for term title, semester duration, and optional Reading Week management with debounced auto-save plus shadcn Field-based form structure]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SettingsSection } from "./SettingsSection";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAutoSave } from "@/hooks/useAutoSave";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";

const parseDateOrUndefined = (value?: string | null) => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

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
  registerFlush?: (flush: () => Promise<void>) => void;
}

export const SemesterSettingsPanel: React.FC<SemesterSettingsPanelProps> = ({
  initialName,
  initialSettings,
  onSave,
  registerFlush,
}) => {
  const isMobile = useIsMobile();
  const startDateRaw = initialSettings?.start_date;
  const endDateRaw = initialSettings?.end_date;
  const readingWeekStartRaw = initialSettings?.reading_week_start;
  const readingWeekEndRaw = initialSettings?.reading_week_end;
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState<Date | undefined>(() => parseDateOrUndefined(startDateRaw));
  const [endDate, setEndDate] = useState<Date | undefined>(() => parseDateOrUndefined(endDateRaw));
  const [readingWeekStart, setReadingWeekStart] = useState<Date | undefined>(() => parseDateOrUndefined(readingWeekStartRaw));
  const [readingWeekEnd, setReadingWeekEnd] = useState<Date | undefined>(() => parseDateOrUndefined(readingWeekEndRaw));
  const fieldId = useId();
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
    const normalizedDay = normalizeToDay(day);
    return normalizedDay < normalizeToDay(startDate) || normalizedDay > normalizeToDay(endDate);
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
    setStartDate(parseDateOrUndefined(savedSnapshot.startDate));
    setEndDate(parseDateOrUndefined(savedSnapshot.endDate));
    setReadingWeekStart(parseDateOrUndefined(savedSnapshot.readingWeekStart));
    setReadingWeekEnd(parseDateOrUndefined(savedSnapshot.readingWeekEnd));
  }, [draftSnapshot, savedSnapshot]);

  const durationError = useMemo(() => {
    if (startDate && endDate && startDate > endDate) {
      return "Start date must be earlier than or equal to end date.";
    }

    return "";
  }, [endDate, startDate]);

  const readingWeekError = useMemo(() => {
    if ((readingWeekStart && !readingWeekEnd) || (!readingWeekStart && readingWeekEnd)) {
      return "Reading Week must include both a start and end date.";
    }

    if (readingWeekStart && readingWeekEnd) {
      if (!startDate || !endDate) {
        return "Set the semester duration before selecting Reading Week.";
      }

      if (differenceInCalendarDays(readingWeekEnd, readingWeekStart) !== 6) {
        return "Reading Week must span exactly one Monday-to-Sunday week.";
      }

      if (readingWeekStart.getDay() !== 1 || readingWeekEnd.getDay() !== 0) {
        return "Reading Week must start on Monday and end on Sunday.";
      }

      if (
        normalizeToDay(readingWeekStart) < normalizeToDay(startDate)
        || normalizeToDay(readingWeekEnd) > normalizeToDay(endDate)
      ) {
        return "Reading Week must stay within the semester duration.";
      }
    }

    return "";
  }, [endDate, readingWeekEnd, readingWeekStart, startDate]);

  const isValid = useMemo(() => {
    return !durationError && !readingWeekError;
  }, [durationError, readingWeekError]);

  const { flush } = useAutoSave({
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
    <SettingsSection title="General" description="Update the name and key settings.">
      <FieldSet>
        <FieldGroup className="max-w-sm">
          <Field>
            <FieldLabel htmlFor={`${fieldId}-name`}>Name</FieldLabel>
            <Input
              id={`${fieldId}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field data-invalid={Boolean(durationError)}>
            <FieldLabel htmlFor={`${fieldId}-date`}>Semester Duration</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id={`${fieldId}-date`}
                  type="button"
                  variant="outline"
                  aria-invalid={Boolean(durationError)}
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
            <FieldDescription>Select the full semester date range.</FieldDescription>
            {durationError ? <FieldError>{durationError}</FieldError> : null}
          </Field>

          <Field data-invalid={Boolean(readingWeekError)}>
            <FieldLabel htmlFor={`${fieldId}-reading-week`}>Reading Week</FieldLabel>
            <FieldDescription>
              Optional. Select the full Reading Week date range. It must span exactly one Monday-to-Sunday week.
            </FieldDescription>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id={`${fieldId}-reading-week`}
                  type="button"
                  variant="outline"
                  aria-invalid={Boolean(readingWeekError)}
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
                  onSelect={(range) => {
                    setReadingWeekStart(range?.from);
                    setReadingWeekEnd(range?.to);
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
            {readingWeekError ? <FieldError>{readingWeekError}</FieldError> : null}
          </Field>
        </FieldGroup>
      </FieldSet>
    </SettingsSection>
  );
};
