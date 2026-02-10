import React from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import scheduleService from '@/services/schedule';
import type { ExportRange, SkipRenderMode } from '@/services/schedule';
import { ALL_FILTER_VALUE, DEFAULT_WEEK } from '../../shared/constants';

type ExportFormat = 'png' | 'pdf' | 'ics';

interface SemesterScheduleExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  maxWeek: number;
  courseOptions: Array<{ id: string; name: string }>;
}

const clampWeek = (week: number, maxWeek: number) => {
  return Math.max(DEFAULT_WEEK, Math.min(maxWeek, Math.floor(week)));
};

const normalizeWeekRange = (startWeek: number, endWeek: number, maxWeek: number) => {
  const normalizedStart = clampWeek(startWeek, maxWeek);
  const normalizedEnd = clampWeek(endWeek, maxWeek);
  if (normalizedStart <= normalizedEnd) {
    return { startWeek: normalizedStart, endWeek: normalizedEnd };
  }
  return { startWeek: normalizedEnd, endWeek: normalizedStart };
};

export const SemesterScheduleExportModal: React.FC<SemesterScheduleExportModalProps> = ({
  open,
  onOpenChange,
  semesterId,
  maxWeek,
  courseOptions,
}) => {
  const boundedMaxWeek = Math.max(DEFAULT_WEEK, maxWeek);
  const [courseFilter, setCourseFilter] = React.useState<string>(ALL_FILTER_VALUE);
  const [range, setRange] = React.useState<ExportRange>('week');
  const [week, setWeek] = React.useState<number>(DEFAULT_WEEK);
  const [startWeek, setStartWeek] = React.useState<number>(DEFAULT_WEEK);
  const [endWeek, setEndWeek] = React.useState<number>(DEFAULT_WEEK);
  const [skipRenderMode, setSkipRenderMode] = React.useState<SkipRenderMode>('GRAY_SKIPPED');
  const [format, setFormat] = React.useState<ExportFormat>('ics');
  const [isExporting, setIsExporting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setWeek((current) => clampWeek(current, boundedMaxWeek));
    setStartWeek((current) => clampWeek(current, boundedMaxWeek));
    setEndWeek((current) => clampWeek(current, boundedMaxWeek));
  }, [boundedMaxWeek, open]);

  const handleExport = async () => {
    if (!semesterId) return;

    const scope = courseFilter === ALL_FILTER_VALUE ? 'semester' : 'course';
    const scopeId = scope === 'semester' ? semesterId : courseFilter;
    const payload: {
      scope: 'semester' | 'course';
      scopeId: string;
      range: ExportRange;
      week?: number;
      startWeek?: number;
      endWeek?: number;
      skipRenderMode: SkipRenderMode;
    } = {
      scope,
      scopeId,
      range,
      skipRenderMode,
    };

    if (range === 'week') {
      payload.week = clampWeek(week, boundedMaxWeek);
    } else if (range === 'weeks') {
      const normalized = normalizeWeekRange(startWeek, endWeek, boundedMaxWeek);
      payload.startWeek = normalized.startWeek;
      payload.endWeek = normalized.endWeek;
    }

    setIsExporting(true);
    try {
      const result = await scheduleService.exportSchedule(format, payload);

      if (format === 'ics') {
        const blob = result as Blob;
        const filenameScope = scope === 'semester' ? `semester-${semesterId}` : `course-${scopeId}`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${filenameScope}.ics`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } else {
        const exported = result as { itemCount?: number };
        toast.success(`Exported ${exported.itemCount ?? 0} items as ${format.toUpperCase()}.`);
      }

      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? `Failed to export ${format}.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Export Schedule</DialogTitle>
          <DialogDescription>
            Configure filters and export format for semester schedule export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="export-course-filter">Course filter</Label>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger id="export-course-filter" className="w-full">
                <SelectValue placeholder="Select course filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Courses</SelectLabel>
                  <SelectItem value={ALL_FILTER_VALUE}>All courses</SelectItem>
                  {courseOptions.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export-range">Range</Label>
              <Select value={range} onValueChange={(value) => setRange(value as ExportRange)}>
                <SelectTrigger id="export-range" className="w-full">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Ranges</SelectLabel>
                    <SelectItem value="week">Single week</SelectItem>
                    <SelectItem value="weeks">Week range</SelectItem>
                    <SelectItem value="term">Full term</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="export-format">Format</Label>
              <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                <SelectTrigger id="export-format" className="w-full">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Formats</SelectLabel>
                    <SelectItem value="ics">ICS</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {range === 'week' ? (
            <div className="space-y-2">
              <Label htmlFor="export-week">Week</Label>
              <Input
                id="export-week"
                type="number"
                min={1}
                max={boundedMaxWeek}
                value={week}
                onChange={(event) => setWeek(Number(event.target.value || DEFAULT_WEEK))}
              />
            </div>
          ) : null}

          {range === 'weeks' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="export-start-week">Start week</Label>
                <Input
                  id="export-start-week"
                  type="number"
                  min={1}
                  max={boundedMaxWeek}
                  value={startWeek}
                  onChange={(event) => setStartWeek(Number(event.target.value || DEFAULT_WEEK))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="export-end-week">End week</Label>
                <Input
                  id="export-end-week"
                  type="number"
                  min={1}
                  max={boundedMaxWeek}
                  value={endWeek}
                  onChange={(event) => setEndWeek(Number(event.target.value || DEFAULT_WEEK))}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="export-skipped-mode">Skipped events</Label>
            <Select value={skipRenderMode} onValueChange={(value) => setSkipRenderMode(value as SkipRenderMode)}>
              <SelectTrigger id="export-skipped-mode" className="w-full">
                <SelectValue placeholder="Select skipped mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Skipped Events</SelectLabel>
                  <SelectItem value="GRAY_SKIPPED">Render as grayed</SelectItem>
                  <SelectItem value="HIDE_SKIPPED">Hide skipped</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleExport()} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
