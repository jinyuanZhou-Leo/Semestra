// input:  [semester basics draft values, shadcn field and date-picker primitives, date-fns helpers, and mobile viewport detection]
// output: [`SemesterBasicsFields` component plus Semester basics validation helpers and value type]
// pos:    [Shared Semester name and date-range form fields that keep wizard and settings flows on one shadcn date-picker implementation and one Reading Week validation model]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useId, useMemo } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SemesterBasicsValue {
  name: string;
  start_date: string;
  end_date: string;
  reading_week_start: string;
  reading_week_end: string;
}

export interface SemesterBasicsValidation {
  durationError: string;
  readingWeekError: string;
  hasDurationError: boolean;
  hasReadingWeekError: boolean;
  isValid: boolean;
}

interface SemesterBasicsFieldsProps {
  value: SemesterBasicsValue;
  onChange: (value: SemesterBasicsValue) => void;
  showRequiredIndicators?: boolean;
  className?: string;
}

const parseDateOrUndefined = (value?: string | null) => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toIsoDate = (value?: Date) => (value ? format(value, "yyyy-MM-dd") : "");

const normalizeToDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const getSemesterBasicsValidation = (
  value: Pick<SemesterBasicsValue, "start_date" | "end_date" | "reading_week_start" | "reading_week_end">,
): SemesterBasicsValidation => {
  const startDate = parseDateOrUndefined(value.start_date);
  const endDate = parseDateOrUndefined(value.end_date);
  const readingWeekStart = parseDateOrUndefined(value.reading_week_start);
  const readingWeekEnd = parseDateOrUndefined(value.reading_week_end);

  let durationError = "";
  if (startDate && endDate && startDate > endDate) {
    durationError = "Start date must be earlier than or equal to end date.";
  }

  let readingWeekError = "";
  if ((readingWeekStart && !readingWeekEnd) || (!readingWeekStart && readingWeekEnd)) {
    readingWeekError = "Reading Week must include both a start and end date.";
  } else if (readingWeekStart && readingWeekEnd) {
    if (!startDate || !endDate) {
      readingWeekError = "Set the semester duration before selecting Reading Week.";
    } else if (differenceInCalendarDays(readingWeekEnd, readingWeekStart) !== 6) {
      readingWeekError = "Reading Week must span exactly one Monday-to-Sunday week.";
    } else if (readingWeekStart.getDay() !== 1 || readingWeekEnd.getDay() !== 0) {
      readingWeekError = "Reading Week must start on Monday and end on Sunday.";
    } else if (
      normalizeToDay(readingWeekStart) < normalizeToDay(startDate)
      || normalizeToDay(readingWeekEnd) > normalizeToDay(endDate)
    ) {
      readingWeekError = "Reading Week must stay within the semester duration.";
    }
  }

  return {
    durationError,
    readingWeekError,
    hasDurationError: durationError.length > 0,
    hasReadingWeekError: readingWeekError.length > 0,
    isValid: durationError.length === 0 && readingWeekError.length === 0,
  };
};

export const SemesterBasicsFields: React.FC<SemesterBasicsFieldsProps> = ({
  value,
  onChange,
  showRequiredIndicators = false,
  className,
}) => {
  const isMobile = useIsMobile();
  const fieldId = useId();
  const startDate = useMemo(() => parseDateOrUndefined(value.start_date), [value.start_date]);
  const endDate = useMemo(() => parseDateOrUndefined(value.end_date), [value.end_date]);
  const readingWeekStart = useMemo(() => parseDateOrUndefined(value.reading_week_start), [value.reading_week_start]);
  const readingWeekEnd = useMemo(() => parseDateOrUndefined(value.reading_week_end), [value.reading_week_end]);
  const validation = useMemo(
    () => getSemesterBasicsValidation(value),
    [value.end_date, value.reading_week_end, value.reading_week_start, value.start_date],
  );

  const dateRangeLabel = startDate
    ? endDate
      ? `${format(startDate, "PP")} - ${format(endDate, "PP")}`
      : format(startDate, "PP")
    : "Pick a date range";
  const readingWeekLabel = readingWeekStart && readingWeekEnd
    ? `${format(readingWeekStart, "PP")} - ${format(readingWeekEnd, "PP")}`
    : "Optional";

  const isReadingWeekDateDisabled = (day: Date) => {
    if (!startDate || !endDate) return false;
    const normalizedDay = normalizeToDay(day);
    return normalizedDay < normalizeToDay(startDate) || normalizedDay > normalizeToDay(endDate);
  };

  const nameLabel = showRequiredIndicators ? (
    <>
      Name <span className="text-destructive">*</span>
    </>
  ) : "Name";

  const durationLabel = showRequiredIndicators ? (
    <>
      Semester Duration <span className="text-destructive">*</span>
    </>
  ) : "Semester Duration";

  return (
    <FieldGroup className={className}>
      <Field>
        <FieldLabel htmlFor={`${fieldId}-name`}>{nameLabel}</FieldLabel>
        <Input
          id={`${fieldId}-name`}
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
        />
      </Field>

      <Field data-invalid={validation.hasDurationError ? true : undefined}>
        <FieldLabel htmlFor={`${fieldId}-date`}>{durationLabel}</FieldLabel>
        <FieldDescription>Select the full semester date range.</FieldDescription>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={`${fieldId}-date`}
              type="button"
              variant="outline"
              data-empty={!startDate}
              aria-invalid={validation.hasDurationError ? true : undefined}
              className={cn(
                "w-full min-w-0 justify-start overflow-hidden text-left font-normal data-[empty=true]:text-muted-foreground",
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
                onChange({
                  ...value,
                  start_date: toIsoDate(range?.from),
                  end_date: toIsoDate(range?.to),
                });
              }}
              numberOfMonths={isMobile ? 1 : 2}
            />
          </PopoverContent>
        </Popover>
        {validation.durationError ? <FieldError>{validation.durationError}</FieldError> : null}
      </Field>

      <Field data-invalid={validation.hasReadingWeekError ? true : undefined}>
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
              data-empty={!readingWeekStart}
              aria-invalid={validation.hasReadingWeekError ? true : undefined}
              className="w-full min-w-0 justify-start overflow-hidden text-left font-normal data-[empty=true]:text-muted-foreground"
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
                onChange({
                  ...value,
                  reading_week_start: toIsoDate(range?.from),
                  reading_week_end: toIsoDate(range?.to),
                });
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
                  onChange({
                    ...value,
                    reading_week_start: "",
                    reading_week_end: "",
                  });
                }}
                disabled={!readingWeekStart && !readingWeekEnd}
              >
                Clear Reading Week
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {validation.readingWeekError ? <FieldError>{validation.readingWeekError}</FieldError> : null}
      </Field>
    </FieldGroup>
  );
};
