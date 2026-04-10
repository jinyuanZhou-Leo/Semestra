// input:  [semester export open state, schedule export filters, course options, render window bounds, event color/settings, schedule service, and shadcn scroll-area]
// output: [`SemesterScheduleExportModal` with DOM-based PNG/PDF export backed by the shared FullCalendar export surface]
// pos:    [Calendar export dialog that filters weekly schedule data and renders downloadable ICS plus browser-rendered PNG/PDF outputs without a second hand-drawn calendar style system]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { flushSync } from 'react-dom';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import scheduleService, {
  type ExportScope,
  type ScheduleItem,
  type SkipRenderMode,
} from '@/services/schedule';
import { ALL_FILTER_VALUE } from '../../shared/constants';
import { normalizeDayMinuteWindow, toTimeInputValue } from './settings';
import {
  dedupeExportScheduleItems,
  getSemesterScheduleExportDimensions,
  SemesterScheduleExportSurface,
  type SemesterScheduleExportDimensions,
} from './SemesterScheduleExportSurface';

type ExportFormat = 'png' | 'pdf' | 'ics';

interface SemesterScheduleExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  maxWeek: number;
  courseOptions: Array<{ id: string; name: string }>;
  dayStartMinutes: number;
  dayEndMinutes: number;
  eventColor: string;
  highlightConflicts: boolean;
  showWeekends: boolean;
  weekViewDayCount: number;
}

interface ExportRenderJob {
  title: string;
  subtitle: string;
  items: ScheduleItem[];
  dimensions: SemesterScheduleExportDimensions;
  dayStartMinutes: number;
  dayEndMinutes: number;
}

const PDF_PAGE_WIDTH = 842;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const waitForNextFrame = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => resolve());
  });
});

const waitForExportSurface = async () => {
  if ('fonts' in document) {
    await document.fonts.ready.catch(() => undefined);
  }
  await waitForNextFrame();
  await new Promise((resolve) => {
    window.setTimeout(resolve, 80);
  });
  await waitForNextFrame();
};

const captureExportSurfacePng = async (
  node: HTMLElement,
  dimensions: SemesterScheduleExportDimensions,
) => {
  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(node, {
    backgroundColor: getComputedStyle(node).backgroundColor || '#ffffff',
    cacheBust: true,
    height: dimensions.height,
    pixelRatio: 2,
    width: dimensions.width,
  });

  if (!blob) {
    throw new Error('Failed to generate PNG file.');
  }

  return blob;
};

const pngToPdfBlob = async (pngBlob: Blob) => {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(await pngBlob.arrayBuffer());
  const pageWidth = PDF_PAGE_WIDTH;
  const pageHeight = (pageWidth * png.height) / png.width;
  const page = pdf.addPage([pageWidth, pageHeight]);

  page.drawImage(png, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  const pdfBytes = await pdf.save();
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  return new Blob([pdfBuffer], { type: 'application/pdf' });
};

export const SemesterScheduleExportModal: React.FC<SemesterScheduleExportModalProps> = ({
  open,
  onOpenChange,
  semesterId,
  maxWeek,
  courseOptions,
  dayStartMinutes,
  dayEndMinutes,
  eventColor,
  highlightConflicts,
  showWeekends,
  weekViewDayCount,
}) => {
  const exportStageRef = React.useRef<HTMLDivElement | null>(null);
  const [courseFilter, setCourseFilter] = React.useState<string>(ALL_FILTER_VALUE);
  const [skipRenderMode, setSkipRenderMode] = React.useState<SkipRenderMode>('GRAY_SKIPPED');
  const [format, setFormat] = React.useState<ExportFormat>('ics');
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportRenderJob, setExportRenderJob] = React.useState<ExportRenderJob | null>(null);

  const handleExport = async () => {
    if (!semesterId) return;

    const scope: ExportScope = courseFilter === ALL_FILTER_VALUE ? 'semester' : 'course';
    const scopeId = scope === 'semester' ? semesterId : courseFilter;
    const payload = {
      scope,
      scopeId,
      range: 'term' as const,
      skipRenderMode,
    };

    setIsExporting(true);
    try {
      const result = await scheduleService.exportSchedule(format, payload);
      const filenameScope = scope === 'semester' ? `semester-${semesterId}` : `course-${scopeId}`;

      if (format === 'ics') {
        downloadBlob(result as Blob, `${filenameScope}.ics`);
        onOpenChange(false);
        return;
      }

      const exportData = result as { items: ScheduleItem[]; itemCount?: number };
      const timeWindow = normalizeDayMinuteWindow(dayStartMinutes, dayEndMinutes);
      const dedupedItems = dedupeExportScheduleItems(exportData.items ?? []);
      const dimensions = getSemesterScheduleExportDimensions(timeWindow.dayStartMinutes, timeWindow.dayEndMinutes);
      const title = `Semestra Weekly Calendar (${scope === 'semester' ? 'All Courses' : 'Single Course'})`;
      const subtitle = `Time window: ${toTimeInputValue(timeWindow.dayStartMinutes)} - ${toTimeInputValue(timeWindow.dayEndMinutes)} · Rendered with Calendar view styling`;

      flushSync(() => {
        setExportRenderJob({
          title,
          subtitle,
          items: dedupedItems,
          dimensions,
          dayStartMinutes: timeWindow.dayStartMinutes,
          dayEndMinutes: timeWindow.dayEndMinutes,
        });
      });

      const exportNode = exportStageRef.current;
      if (!exportNode) {
        throw new Error('Unable to mount export surface.');
      }

      await waitForExportSurface();
      const pngBlob = await captureExportSurfacePng(exportNode, dimensions);

      if (format === 'png') {
        downloadBlob(pngBlob, `${filenameScope}.png`);
      } else {
        const pdfBlob = await pngToPdfBlob(pngBlob);
        downloadBlob(pdfBlob, `${filenameScope}.pdf`);
      }

      toast.success(`Exported ${exportData.itemCount ?? dedupedItems.length} items as ${format.toUpperCase()}.`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? `Failed to export ${format}.`);
    } finally {
      flushSync(() => {
        setExportRenderJob(null);
      });
      setIsExporting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Export Schedule</DialogTitle>
            <DialogDescription>
              Export a full weekly calendar view (week 1 to week {Math.max(1, maxWeek)}), using the same day time window as Calendar settings:
              {' '}
              {toTimeInputValue(dayStartMinutes)} - {toTimeInputValue(dayEndMinutes)}.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 pr-4">
              <div className="flex flex-col gap-2">
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

              <div className="flex flex-col gap-2">
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

              <div className="flex flex-col gap-2">
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
          </ScrollArea>

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

      {exportRenderJob ? (
        <div
          className="pointer-events-none fixed top-0 overflow-hidden bg-background"
          style={{
            left: '-20000px',
            width: `${exportRenderJob.dimensions.width}px`,
            height: `${exportRenderJob.dimensions.height}px`,
          }}
          aria-hidden="true"
        >
          <div
            ref={exportStageRef}
            className="bg-background"
            style={{
              width: `${exportRenderJob.dimensions.width}px`,
              height: `${exportRenderJob.dimensions.height}px`,
            }}
          >
            <SemesterScheduleExportSurface
              title={exportRenderJob.title}
              subtitle={exportRenderJob.subtitle}
              items={exportRenderJob.items}
              dayStartMinutes={exportRenderJob.dayStartMinutes}
              dayEndMinutes={exportRenderJob.dayEndMinutes}
              eventColor={eventColor}
              highlightConflicts={highlightConflicts}
              showWeekends={showWeekends}
              weekViewDayCount={weekViewDayCount}
            />
          </div>
        </div>
      ) : null}
    </>
  );
};
