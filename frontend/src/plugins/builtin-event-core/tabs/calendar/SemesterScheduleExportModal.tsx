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
import scheduleService, {
  type ExportScope,
  type ScheduleItem,
  type SkipRenderMode,
  type WeekPattern,
} from '@/services/schedule';
import { ALL_FILTER_VALUE } from '../../shared/constants';
import { normalizeDayMinuteWindow, toTimeInputValue } from './settings';

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
}

interface ExportRenderableItem {
  eventId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  courseName: string;
  eventTypeCode: string;
  weekPattern: WeekPattern;
  isSkipped: boolean;
  isConflict: boolean;
}

interface PositionedItem extends ExportRenderableItem {
  startMinute: number;
  endMinute: number;
  lane: number;
  laneCount: number;
}

interface WeekCalendarModel {
  minuteStart: number;
  minuteEnd: number;
  totalMinutes: number;
  hourMarks: number[];
  byDay: Map<number, PositionedItem[]>;
}

const DAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

const DEFAULT_EVENT_COLOR = '#2563eb';
const EVENT_BG_ALPHA_SUFFIX = '1f';

const toMinutes = (value: string) => {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return (hour * 60) + minute;
};

const formatMinutes = (minutes: number) => {
  const bounded = Math.max(0, Math.min(24 * 60, minutes));
  const hour = Math.floor(bounded / 60);
  const minute = bounded % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const normalizeHexColor = (value: string) => (/^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_EVENT_COLOR);

const addAlpha = (hexColor: string, alphaHex = EVENT_BG_ALPHA_SUFFIX) => {
  const normalized = normalizeHexColor(hexColor);
  return `${normalized}${alphaHex}`;
};

const hexToRgb = (hexColor: string) => {
  const normalized = normalizeHexColor(hexColor);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

const blendWithWhite = (hexColor: string, ratio = 0.88) => {
  const { r, g, b } = hexToRgb(hexColor);
  return {
    r: Math.round(255 - ((255 - r) * (1 - ratio))),
    g: Math.round(255 - ((255 - g) * (1 - ratio))),
    b: Math.round(255 - ((255 - b) * (1 - ratio))),
  };
};

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

const dedupeExportItems = (items: ScheduleItem[]) => {
  const byEventId = new Map<string, ExportRenderableItem>();

  for (const item of items) {
    const normalizedPattern: WeekPattern = item.weekPattern === 'ALTERNATING' ? 'ALTERNATING' : 'EVERY';
    const existing = byEventId.get(item.eventId);
    if (!existing) {
      byEventId.set(item.eventId, {
        eventId: item.eventId,
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        courseName: item.courseName,
        eventTypeCode: item.eventTypeCode,
        weekPattern: normalizedPattern,
        isSkipped: Boolean(item.skip),
        isConflict: Boolean(item.isConflict),
      });
      continue;
    }

    if (existing.isSkipped && !item.skip) {
      existing.isSkipped = false;
    }
    if (!existing.isConflict && item.isConflict) {
      existing.isConflict = true;
    }
  }

  return Array.from(byEventId.values()).sort((a, b) => (
    a.dayOfWeek - b.dayOfWeek
    || toMinutes(a.startTime) - toMinutes(b.startTime)
    || toMinutes(a.endTime) - toMinutes(b.endTime)
    || a.courseName.localeCompare(b.courseName)
  ));
};

const assignLanes = (items: ExportRenderableItem[]) => {
  const sorted: PositionedItem[] = items
    .map((item) => {
      const startMinute = toMinutes(item.startTime);
      const endMinute = Math.max(toMinutes(item.endTime), startMinute + 30);
      return {
        ...item,
        startMinute,
        endMinute,
        lane: 0,
        laneCount: 1,
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const active: Array<{ endMinute: number; lane: number }> = [];
  const clusterIndexes: number[] = [];
  let maxLaneInCluster = 0;

  const finalizeCluster = () => {
    if (clusterIndexes.length === 0) return;
    const laneCount = maxLaneInCluster + 1;
    for (const index of clusterIndexes) {
      sorted[index].laneCount = laneCount;
    }
    clusterIndexes.length = 0;
    maxLaneInCluster = 0;
  };

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    for (let activeIndex = active.length - 1; activeIndex >= 0; activeIndex -= 1) {
      if (active[activeIndex].endMinute <= event.startMinute) {
        active.splice(activeIndex, 1);
      }
    }

    if (active.length === 0) {
      finalizeCluster();
    }

    const usedLanes = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (usedLanes.has(lane)) {
      lane += 1;
    }

    sorted[index].lane = lane;
    maxLaneInCluster = Math.max(maxLaneInCluster, lane);
    clusterIndexes.push(index);
    active.push({ endMinute: event.endMinute, lane });
  }

  finalizeCluster();
  return sorted;
};

const buildWeekCalendarModel = (
  items: ExportRenderableItem[],
  dayStartMinutes: number,
  dayEndMinutes: number,
): WeekCalendarModel => {
  const minuteWindow = normalizeDayMinuteWindow(dayStartMinutes, dayEndMinutes);
  const minuteStart = minuteWindow.dayStartMinutes;
  const minuteEnd = minuteWindow.dayEndMinutes;
  const totalMinutes = Math.max(60, minuteEnd - minuteStart);
  const byDay = new Map<number, PositionedItem[]>();

  for (let day = 1; day <= 7; day += 1) {
    const dayItems = items.filter((item) => item.dayOfWeek === day);
    byDay.set(day, assignLanes(dayItems));
  }

  const hourMarks: number[] = [];
  const firstHour = Math.ceil(minuteStart / 60) * 60;
  hourMarks.push(minuteStart);
  for (let minute = firstHour; minute < minuteEnd; minute += 60) {
    if (hourMarks[hourMarks.length - 1] === minute) continue;
    hourMarks.push(minute);
  }
  if (hourMarks[hourMarks.length - 1] !== minuteEnd) {
    hourMarks.push(minuteEnd);
  }

  return {
    minuteStart,
    minuteEnd,
    totalMinutes,
    hourMarks,
    byDay,
  };
};

const drawTextClipped = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) => {
  let output = text;
  if (ctx.measureText(output).width <= maxWidth) {
    ctx.fillText(output, x, y);
    return;
  }
  while (output.length > 0 && ctx.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  ctx.fillText(output.length > 0 ? `${output}...` : '...', x, y);
};

const exportWeekCalendarToPng = async (
  title: string,
  subtitle: string,
  model: WeekCalendarModel,
  eventColor: string,
) => {
  const dayColumns = [1, 2, 3, 4, 5, 6, 7];
  const titleAreaHeight = 64;
  const dayHeaderHeight = 42;
  const timeAxisWidth = 72;
  const columnWidth = 184;
  const totalWidth = timeAxisWidth + (columnWidth * dayColumns.length);
  const calendarHeight = Math.max(720, Math.round(model.totalMinutes * 1.05));
  const totalHeight = titleAreaHeight + dayHeaderHeight + calendarHeight + 18;
  const gridTop = titleAreaHeight + dayHeaderHeight;
  const baseEventColor = normalizeHexColor(eventColor);
  const rasterScale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(totalWidth * rasterScale);
  canvas.height = Math.round(totalHeight * rasterScale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize PNG export context.');
  ctx.setTransform(rasterScale, 0, 0, rasterScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 20px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillText(title, 16, 30);
  ctx.fillStyle = '#475569';
  ctx.font = '12px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillText(subtitle, 16, 50);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, titleAreaHeight, totalWidth, dayHeaderHeight);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, titleAreaHeight, totalWidth, dayHeaderHeight);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, gridTop, timeAxisWidth, calendarHeight);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(0, gridTop, timeAxisWidth, calendarHeight);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillText('TIME', 20, titleAreaHeight + 24);

  for (let dayIndex = 0; dayIndex < dayColumns.length; dayIndex += 1) {
    const day = dayColumns[dayIndex];
    const x = timeAxisWidth + (dayIndex * columnWidth);
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(x, titleAreaHeight);
    ctx.lineTo(x, totalHeight);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText(DAY_LABELS[day].toUpperCase(), x + 8, titleAreaHeight + 16);
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 14px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText(DAY_LABELS[day], x + 8, titleAreaHeight + 33);
  }

  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(timeAxisWidth, titleAreaHeight);
  ctx.lineTo(timeAxisWidth, totalHeight);
  ctx.stroke();

  for (const minute of model.hourMarks) {
    const offset = ((minute - model.minuteStart) / model.totalMinutes) * calendarHeight;
    const y = gridTop + offset;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(totalWidth, y);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '10px ui-sans-serif, system-ui, -apple-system, sans-serif';
    const labelY = minute === model.minuteEnd ? y - 4 : y + 10;
    drawTextClipped(ctx, formatMinutes(minute), 8, labelY, timeAxisWidth - 12);
  }

  for (let dayIndex = 0; dayIndex < dayColumns.length; dayIndex += 1) {
    const day = dayColumns[dayIndex];
    const events = model.byDay.get(day) ?? [];
    const dayStartX = timeAxisWidth + (dayIndex * columnWidth);
    for (const event of events) {
      const laneGap = 3;
      const dayInnerPadding = 6;
      const availableWidth = columnWidth - (dayInnerPadding * 2);
      const eventWidth = Math.max(
        36,
        (availableWidth - ((event.laneCount - 1) * laneGap)) / event.laneCount,
      );
      const visibleStart = Math.max(event.startMinute, model.minuteStart);
      const visibleEnd = Math.min(event.endMinute, model.minuteEnd);
      if (visibleEnd <= visibleStart) {
        continue;
      }

      const x = dayStartX + dayInnerPadding + event.lane * (eventWidth + laneGap);
      const y = gridTop + ((visibleStart - model.minuteStart) / model.totalMinutes) * calendarHeight;
      const height = Math.max(24, ((visibleEnd - visibleStart) / model.totalMinutes) * calendarHeight);
      const cardColor = event.isSkipped ? '#e2e8f0' : addAlpha(baseEventColor, EVENT_BG_ALPHA_SUFFIX);
      const borderColor = event.isConflict ? '#ef4444' : '#cbd5e1';
      const stripeColor = event.isSkipped ? '#94a3b8' : baseEventColor;
      const textColor = event.isSkipped ? '#64748b' : '#0f172a';

      ctx.fillStyle = cardColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, eventWidth, height);
      ctx.strokeRect(x, y, eventWidth, height);
      ctx.fillStyle = stripeColor;
      ctx.fillRect(x, y, 3, height);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, y + 2, eventWidth - 4, height - 4);
      ctx.clip();

      ctx.fillStyle = textColor;
      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, sans-serif';
      drawTextClipped(ctx, event.courseName, x + 6, y + 14, eventWidth - 12);
      ctx.font = '10px ui-sans-serif, system-ui, -apple-system, sans-serif';
      drawTextClipped(ctx, event.eventTypeCode, x + 6, y + 27, eventWidth - 12);
      ctx.fillStyle = event.isSkipped ? '#64748b' : '#334155';
      drawTextClipped(ctx, `${event.startTime} - ${event.endTime}`, x + 6, y + 39, eventWidth - 12);
      ctx.restore();

      if (event.weekPattern === 'ALTERNATING') {
        const badgeWidth = 70;
        const badgeHeight = 14;
        const badgeX = x + eventWidth - badgeWidth - 4;
        const badgeY = y + 4;
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        ctx.strokeStyle = '#f59e0b';
        ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);
        ctx.fillStyle = '#92400e';
        ctx.font = '600 9px ui-sans-serif, system-ui, -apple-system, sans-serif';
        ctx.fillText('Alternating', badgeX + 6, badgeY + 10.5);
      }
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Failed to generate PNG file.'));
        return;
      }
      resolve(result);
    }, 'image/png');
  });

  return blob;
};

const escapePdfText = (value: string) => {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
};

const truncatePdfText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

const exportWeekCalendarToPdf = (
  title: string,
  subtitle: string,
  model: WeekCalendarModel,
  eventColor: string,
) => {
  const dayColumns = [1, 2, 3, 4, 5, 6, 7];
  const titleAreaHeight = 64;
  const dayHeaderHeight = 42;
  const timeAxisWidth = 72;
  const columnWidth = 184;
  const pageWidth = timeAxisWidth + (columnWidth * dayColumns.length);
  const calendarHeight = Math.max(720, Math.round(model.totalMinutes * 1.05));
  const pageHeight = titleAreaHeight + dayHeaderHeight + calendarHeight + 18;
  const gridTop = titleAreaHeight + dayHeaderHeight;
  const baseEventColor = normalizeHexColor(eventColor);
  const baseEventRgb = hexToRgb(baseEventColor);
  const lightEventRgb = blendWithWhite(baseEventColor, 0.88);
  const commands: string[] = [];

  const pushText = (
    text: string,
    x: number,
    baselineY: number,
    size = 9,
    color: { r: number; g: number; b: number } = { r: 15, g: 23, b: 42 },
  ) => {
    const yPdf = pageHeight - baselineY;
    commands.push(
      `${(color.r / 255).toFixed(3)} ${(color.g / 255).toFixed(3)} ${(color.b / 255).toFixed(3)} rg BT /F1 ${size} Tf ${x.toFixed(2)} ${yPdf.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`,
    );
  };

  const pushLine = (x1: number, y1Top: number, x2: number, y2Top: number, gray = 0.82, width = 0.5) => {
    const y1 = pageHeight - y1Top;
    const y2 = pageHeight - y2Top;
    commands.push(`${width} w ${gray} ${gray} ${gray} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  const fillRect = (x: number, yTop: number, width: number, height: number, r: number, g: number, b: number) => {
    const y = pageHeight - yTop - height;
    commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  };

  const strokeRect = (x: number, yTop: number, width: number, height: number, gray = 0.7) => {
    const y = pageHeight - yTop - height;
    commands.push(`0.5 w ${gray.toFixed(3)} ${gray.toFixed(3)} ${gray.toFixed(3)} RG ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  };

  fillRect(0, 0, pageWidth, pageHeight, 1, 1, 1);
  fillRect(0, titleAreaHeight, pageWidth, dayHeaderHeight, 0.973, 0.980, 0.988);
  strokeRect(0, titleAreaHeight, pageWidth, dayHeaderHeight, 0.80);
  fillRect(0, gridTop, timeAxisWidth, calendarHeight, 0.973, 0.980, 0.988);
  strokeRect(0, gridTop, timeAxisWidth, calendarHeight, 0.80);

  pushText(title, 16, 30, 20, { r: 15, g: 23, b: 42 });
  pushText(subtitle, 16, 50, 12, { r: 71, g: 85, b: 105 });
  pushText('TIME', 20, titleAreaHeight + 24, 10, { r: 100, g: 116, b: 139 });

  for (let dayIndex = 0; dayIndex < dayColumns.length; dayIndex += 1) {
    const x = timeAxisWidth + (dayIndex * columnWidth);
    pushLine(x, titleAreaHeight, x, pageHeight, 0.80, 0.5);
    pushText(DAY_LABELS[dayColumns[dayIndex]].toUpperCase(), x + 8, titleAreaHeight + 16, 10, { r: 100, g: 116, b: 139 });
    pushText(DAY_LABELS[dayColumns[dayIndex]], x + 8, titleAreaHeight + 33, 14, { r: 15, g: 23, b: 42 });
  }
  pushLine(timeAxisWidth, titleAreaHeight, timeAxisWidth, pageHeight, 0.80, 0.5);

  for (const minute of model.hourMarks) {
    const y = gridTop + ((minute - model.minuteStart) / model.totalMinutes) * calendarHeight;
    pushLine(0, y, pageWidth, y, 0.88, 0.5);
    const labelY = minute === model.minuteEnd ? y - 4 : y + 10;
    pushText(formatMinutes(minute), 8, labelY, 10, { r: 100, g: 116, b: 139 });
  }

  for (let dayIndex = 0; dayIndex < dayColumns.length; dayIndex += 1) {
    const day = dayColumns[dayIndex];
    const dayEvents = model.byDay.get(day) ?? [];
    const dayStartX = timeAxisWidth + (dayIndex * columnWidth);
    for (const event of dayEvents) {
      const laneGap = 3;
      const dayInnerPadding = 6;
      const availableWidth = columnWidth - (dayInnerPadding * 2);
      const width = Math.max(36, (availableWidth - ((event.laneCount - 1) * laneGap)) / event.laneCount);
      const visibleStart = Math.max(event.startMinute, model.minuteStart);
      const visibleEnd = Math.min(event.endMinute, model.minuteEnd);
      if (visibleEnd <= visibleStart) {
        continue;
      }

      const x = dayStartX + dayInnerPadding + event.lane * (width + laneGap);
      const y = gridTop + ((visibleStart - model.minuteStart) / model.totalMinutes) * calendarHeight;
      const height = Math.max(24, ((visibleEnd - visibleStart) / model.totalMinutes) * calendarHeight);

      if (event.isSkipped) {
        fillRect(x, y, width, height, 0.886, 0.910, 0.941);
      } else {
        fillRect(
          x,
          y,
          width,
          height,
          lightEventRgb.r / 255,
          lightEventRgb.g / 255,
          lightEventRgb.b / 255,
        );
      }

      if (event.isConflict) {
        strokeRect(x, y, width, height, 0.52);
      } else {
        strokeRect(x, y, width, height, 0.80);
      }

      const stripeRgb = event.isSkipped ? { r: 148, g: 163, b: 184 } : baseEventRgb;
      fillRect(
        x,
        y,
        2.8,
        height,
        stripeRgb.r / 255,
        stripeRgb.g / 255,
        stripeRgb.b / 255,
      );

      const textLimit = Math.max(8, Math.floor((width - 12) / 6));
      pushText(
        truncatePdfText(event.courseName, textLimit),
        x + 6,
        y + 14,
        11,
        event.isSkipped ? { r: 100, g: 116, b: 139 } : { r: 15, g: 23, b: 42 },
      );
      pushText(
        truncatePdfText(event.eventTypeCode, textLimit + 2),
        x + 6,
        y + 27,
        10,
        event.isSkipped ? { r: 100, g: 116, b: 139 } : { r: 15, g: 23, b: 42 },
      );
      pushText(
        truncatePdfText(`${event.startTime} - ${event.endTime}`, textLimit + 4),
        x + 6,
        y + 39,
        10,
        event.isSkipped ? { r: 100, g: 116, b: 139 } : { r: 51, g: 65, b: 85 },
      );

      if (event.weekPattern === 'ALTERNATING') {
        const badgeWidth = 70;
        const badgeHeight = 14;
        const badgeX = x + width - badgeWidth - 4;
        const badgeY = y + 4;
        fillRect(badgeX, badgeY, badgeWidth, badgeHeight, 0.996, 0.953, 0.780);
        strokeRect(badgeX, badgeY, badgeWidth, badgeHeight, 0.58);
        pushText('Alternating', badgeX + 6, badgeY + 10.5, 9, { r: 146, g: 64, b: 14 });
      }
    }
  }

  const streamBody = `${commands.join('\n')}\n`;
  const objects = new Map<number, string>();
  objects.set(1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.set(2, `<< /Length ${streamBody.length} >>\nstream\n${streamBody}endstream`);
  objects.set(3, `<< /Type /Page /Parent 4 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 1 0 R >> >> /Contents 2 0 R >>`);
  objects.set(4, '<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
  objects.set(5, '<< /Type /Catalog /Pages 4 0 R >>');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = new Array(6).fill(0);
  for (let objectId = 1; objectId <= 5; objectId += 1) {
    const body = objects.get(objectId)!;
    offsets[objectId] = pdf.length;
    pdf += `${objectId} 0 obj\n${body}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += 'xref\n0 6\n';
  pdf += '0000000000 65535 f \n';
  for (let objectId = 1; objectId <= 5; objectId += 1) {
    pdf += `${String(offsets[objectId]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 5 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
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
}) => {
  const [courseFilter, setCourseFilter] = React.useState<string>(ALL_FILTER_VALUE);
  const [skipRenderMode, setSkipRenderMode] = React.useState<SkipRenderMode>('GRAY_SKIPPED');
  const [format, setFormat] = React.useState<ExportFormat>('ics');
  const [isExporting, setIsExporting] = React.useState(false);

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
      const dedupedItems = dedupeExportItems(exportData.items ?? []);
      const model = buildWeekCalendarModel(dedupedItems, dayStartMinutes, dayEndMinutes);
      const title = `Semestra Weekly Calendar (${scope === 'semester' ? 'All Courses' : 'Single Course'})`;
      const subtitle = `Time window: ${toTimeInputValue(model.minuteStart)} - ${toTimeInputValue(model.minuteEnd)} · Alternating classes are tagged`;

      if (format === 'png') {
        const pngBlob = await exportWeekCalendarToPng(title, subtitle, model, eventColor);
        downloadBlob(pngBlob, `${filenameScope}.png`);
      } else {
        const pdfBlob = exportWeekCalendarToPdf(title, subtitle, model, eventColor);
        downloadBlob(pdfBlob, `${filenameScope}.pdf`);
      }

      toast.success(`Exported ${exportData.itemCount ?? dedupedItems.length} items as ${format.toUpperCase()}.`);
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
            Export a full weekly calendar view (week 1 to week {Math.max(1, maxWeek)}), using the same day time window as Calendar settings:
            {' '}
            {toTimeInputValue(dayStartMinutes)} - {toTimeInputValue(dayEndMinutes)}.
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
