import React from 'react';
import { CalendarDays, Download, Edit, Plus, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import scheduleService, {
  type CourseEvent,
  type CourseEventType,
  type CourseSection,
  type ScheduleItem,
  type WeekPattern,
} from '@/services/schedule';
import type { TabDefinition, TabProps, TabSettingsProps } from '../../services/tabRegistry';

const WEEK_PATTERNS: WeekPattern[] = ['EVERY', 'ODD', 'EVEN'];
const DAY_OF_WEEK_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];
const BUILTIN_TIMETABLE_TAB_TYPE = 'builtin-academic-timetable';

const CALENDAR_DEFAULT_START_MINUTES = 8 * 60;
const CALENDAR_DEFAULT_END_MINUTES = 20 * 60;
const CALENDAR_MIN_EVENT_HEIGHT = 28;
const CALENDAR_PIXEL_PER_MINUTE = 1.05;
const SLOT_PLANNER_STEP_MINUTES = 30;

const asChecked = (value: boolean | 'indeterminate') => value === true;
const dayLabel = (value: number) => DAY_OF_WEEK_OPTIONS.find((item) => item.value === value)?.label ?? String(value);
const deriveAbbreviationFromCode = (code: string) => code.replace(/[^A-Z0-9]/g, '').slice(0, 4);
const toMinutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return (hour * 60) + minute;
};
const formatHour = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
const toSafeTime = (value: string) => formatHour(Math.max(0, Math.min(23 * 60 + 59, toMinutes(value))));
const timeRangeIsValid = (startTime: string, endTime: string) => toMinutes(endTime) > toMinutes(startTime);
const clampMinute = (minute: number, min: number, max: number) => Math.min(max, Math.max(min, minute));
const slotId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

type SectionSlotDraft = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
};

const SLOT_LOCATION_NOTE_PREFIX = '[loc] ';

const createSectionSlot = (
  dayOfWeek = 1,
  startTime = '09:00',
  endTime = '10:00',
  location = ''
): SectionSlotDraft => ({
  id: slotId(),
  dayOfWeek,
  startTime,
  endTime,
  location,
});

const buildEventNoteWithLocation = (location: string, note?: string | null) => {
  const trimmedLocation = location.trim();
  const trimmedNote = note?.trim();
  return trimmedNote ? `${SLOT_LOCATION_NOTE_PREFIX}${trimmedLocation}\n${trimmedNote}` : `${SLOT_LOCATION_NOTE_PREFIX}${trimmedLocation}`;
};

const extractLocationFromNote = (note?: string | null) => {
  if (!note || !note.startsWith(SLOT_LOCATION_NOTE_PREFIX)) return null;
  const firstLine = note.slice(SLOT_LOCATION_NOTE_PREFIX.length).split('\n')[0];
  return firstLine.trim() || null;
};



const EmptyTableRow: React.FC<{ colSpan: number; message: string }> = ({ colSpan, message }) => (
  <TableRow>
    <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
      {message}
    </TableCell>
  </TableRow>
);

const TableShell: React.FC<{ children: React.ReactNode; minWidthClassName?: string }> = ({
  children,
  minWidthClassName = 'min-w-[720px]',
}) => (
  <div className="overflow-x-auto rounded-md border border-border/70">
    <div className={minWidthClassName}>
      {children}
    </div>
  </div>
);

const PanelHeader: React.FC<{
  title: string;
  description: string;
  right?: React.ReactNode;
}> = ({ title, description, right }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0 space-y-1">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {right}
  </div>
);

const WeeklyCalendarView: React.FC<{ items: ScheduleItem[]; emptyMessage: string }> = ({ items, emptyMessage }) => {
  const calendarData = React.useMemo(() => {
    if (items.length === 0) {
      return {
        startMinute: CALENDAR_DEFAULT_START_MINUTES,
        endMinute: CALENDAR_DEFAULT_END_MINUTES,
        columns: new Map<number, ScheduleItem[]>(),
      };
    }

    let minMinute = Number.POSITIVE_INFINITY;
    let maxMinute = Number.NEGATIVE_INFINITY;
    const columns = new Map<number, ScheduleItem[]>();

    items.forEach((item) => {
      const startMinute = toMinutes(item.startTime);
      const endMinute = Math.max(toMinutes(item.endTime), startMinute + 30);
      minMinute = Math.min(minMinute, startMinute);
      maxMinute = Math.max(maxMinute, endMinute);
      const dayItems = columns.get(item.dayOfWeek) ?? [];
      dayItems.push(item);
      columns.set(item.dayOfWeek, dayItems);
    });

    for (const [day, dayItems] of columns.entries()) {
      columns.set(day, [...dayItems].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)));
    }

    const startMinute = Math.max(0, Math.floor(minMinute / 60) * 60);
    const endMinute = Math.max(startMinute + 60, Math.ceil(maxMinute / 60) * 60);

    return { startMinute, endMinute, columns };
  }, [items]);

  const totalMinutes = Math.max(calendarData.endMinute - calendarData.startMinute, 60);
  const calendarHeight = Math.max(totalMinutes * CALENDAR_PIXEL_PER_MINUTE, 320);
  const hourMarks = React.useMemo(() => {
    const marks: number[] = [];
    for (let minute = calendarData.startMinute; minute <= calendarData.endMinute; minute += 60) {
      marks.push(minute);
    }
    return marks;
  }, [calendarData.endMinute, calendarData.startMinute]);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[880px] rounded-md border border-border/70 bg-background">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
          <div className="border-b border-r border-border/70 bg-muted/35 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Time
          </div>
          {DAY_OF_WEEK_OPTIONS.map((day) => (
            <div
              key={day.value}
              className="border-b border-r border-border/70 bg-muted/35 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground last:border-r-0"
            >
              {day.label}
            </div>
          ))}

          <div className="relative border-r border-border/70 bg-muted/25" style={{ height: `${calendarHeight}px` }}>
            {hourMarks.map((minute) => {
              const top = ((minute - calendarData.startMinute) / totalMinutes) * calendarHeight;
              return (
                <div
                  key={minute}
                  className="absolute inset-x-0 border-t border-border/50 px-1 text-[10px] text-muted-foreground"
                  style={{ top: `${top}px` }}
                >
                  {formatHour(minute)}
                </div>
              );
            })}
          </div>

          {DAY_OF_WEEK_OPTIONS.map((day) => {
            const dayItems = calendarData.columns.get(day.value) ?? [];
            return (
              <div key={day.value} className="relative border-r border-border/70 bg-background last:border-r-0" style={{ height: `${calendarHeight}px` }}>
                {hourMarks.map((minute) => {
                  const top = ((minute - calendarData.startMinute) / totalMinutes) * calendarHeight;
                  return <div key={minute} className="absolute inset-x-0 border-t border-border/40" style={{ top: `${top}px` }} />;
                })}

                {dayItems.map((item) => {
                  const start = toMinutes(item.startTime);
                  const end = Math.max(toMinutes(item.endTime), start + 30);
                  const top = ((start - calendarData.startMinute) / totalMinutes) * calendarHeight;
                  const rawHeight = ((end - start) / totalMinutes) * calendarHeight;
                  const height = Math.max(rawHeight, CALENDAR_MIN_EVENT_HEIGHT);
                  const toneClass = item.skip
                    ? 'border-border/80 bg-muted/70 text-muted-foreground'
                    : item.isConflict
                      ? 'border-destructive/40 bg-destructive/15 text-destructive'
                      : 'border-primary/30 bg-primary/10 text-foreground';

                  return (
                    <div
                      key={`${item.eventId}-${item.week}-${item.dayOfWeek}-${item.startTime}`}
                      className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border px-2 py-1 text-[11px] leading-tight shadow-sm ${toneClass}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="truncate font-medium">{item.courseName}</div>
                      <div className="truncate opacity-85">{item.eventTypeCode}</div>
                      <div className="truncate opacity-75">{item.startTime} - {item.endTime}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SectionSlotPlanner: React.FC<{
  slots: SectionSlotDraft[];
  onAddSlot: () => void;
  onUpdateSlot: (
    slotIdValue: string,
    patch: Partial<Pick<SectionSlotDraft, 'dayOfWeek' | 'startTime' | 'endTime' | 'location'>>
  ) => void;
  onRemoveSlot: (slotIdValue: string) => void;
}> = ({ slots, onAddSlot, onUpdateSlot, onRemoveSlot }) => {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {slots.length === 0 && (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
            No slots yet. Use the button below to add one.
          </div>
        )}

        {slots.map((slot, index) => (
          <div key={slot.id} className="grid items-end gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Slot {index + 1}</Label>
              <Select
                value={String(slot.dayOfWeek)}
                onValueChange={(value) => onUpdateSlot(slot.id, { dayOfWeek: Number(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_OPTIONS.map((dayOption) => (
                    <SelectItem key={`slot-day-option-${slot.id}-${dayOption.value}`} value={String(dayOption.value)}>
                      {dayOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input
                type="time"
                step={SLOT_PLANNER_STEP_MINUTES * 60}
                value={slot.startTime}
                onChange={(event) => onUpdateSlot(slot.id, { startTime: toSafeTime(event.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">End</Label>
              <Input
                type="time"
                step={SLOT_PLANNER_STEP_MINUTES * 60}
                value={slot.endTime}
                onChange={(event) => onUpdateSlot(slot.id, { endTime: toSafeTime(event.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Location</Label>
              <Input
                autoComplete="off"
                placeholder="e.g. BA1130"
                value={slot.location}
                onChange={(event) => onUpdateSlot(slot.id, { location: event.target.value })}
              />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove slot" onClick={() => onRemoveSlot(slot.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button type="button" variant="outline" className="w-full" onClick={onAddSlot}>
          <Plus className="mr-2 h-4 w-4" />
          Add Slot Row
        </Button>
      </div>
    </div>
  );
};

const CourseEventTypeSettingsPanel: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [eventTypes, setEventTypes] = React.useState<CourseEventType[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [editingType, setEditingType] = React.useState<CourseEventType | null>(null);
  const [formType, setFormType] = React.useState({
    code: '',
    abbreviation: '',
    track_attendance: false,
  });

  const loadEventTypes = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const typeData = await scheduleService.getCourseEventTypes(courseId);
      setEventTypes(typeData);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to load event types.');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    loadEventTypes();
  }, [loadEventTypes]);

  const handleCreateOrUpdateEventType = async () => {
    try {
      if (editingType) {
        await scheduleService.updateCourseEventType(courseId, editingType.code, {
          abbreviation: formType.abbreviation,
          trackAttendance: formType.track_attendance,
        });
        setEditingType(null);
      } else {
        await scheduleService.createCourseEventType(courseId, formType);
      }
      setFormType({ code: '', abbreviation: '', track_attendance: false });
      await loadEventTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? `Failed to ${editingType ? 'update' : 'create'} event type.`);
    }
  };

  const handleEditType = (eventType: CourseEventType) => {
    setEditingType(eventType);
    setFormType({
      code: eventType.code,
      abbreviation: eventType.abbreviation,
      track_attendance: eventType.track_attendance,
    });
  };

  const handleCancelEdit = () => {
    setEditingType(null);
    setFormType({ code: '', abbreviation: '', track_attendance: false });
  };

  const handleDeleteEventType = async (eventTypeCode: string) => {
    try {
      await scheduleService.deleteCourseEventType(courseId, eventTypeCode);
      await loadEventTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to delete event type.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-new-type-code">Type</Label>
          <Input
            id="settings-new-type-code"
            autoComplete="off"
            placeholder="e.g. Workshop"
            value={formType.code}
            disabled={!!editingType}
            onChange={(event) => {
              const nextCode = event.target.value;
              setFormType((prev) => {
                const previousDerived = deriveAbbreviationFromCode(prev.code);
                const shouldAutofillAbbreviation =
                  !prev.abbreviation || prev.abbreviation === previousDerived;
                return {
                  ...prev,
                  code: nextCode,
                  abbreviation: shouldAutofillAbbreviation
                    ? deriveAbbreviationFromCode(nextCode)
                    : prev.abbreviation,
                };
              });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-new-type-abbr">Abbreviation</Label>
          <Input
            id="settings-new-type-abbr"
            autoComplete="off"
            placeholder="WS"
            value={formType.abbreviation}
            onChange={(event) => setFormType((prev) => ({ ...prev, abbreviation: event.target.value.toUpperCase() }))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <Checkbox
          id="settings-new-type-track"
          checked={formType.track_attendance}
          onCheckedChange={(checked) => setFormType((prev) => ({ ...prev, track_attendance: asChecked(checked) }))}
        />
        <Label htmlFor="settings-new-type-track" className="text-sm font-normal text-muted-foreground">
          Track attendance (forces `skip=false`)
        </Label>
      </div>
      <div className="flex justify-end gap-2">
        {editingType && (
          <Button variant="outline" onClick={handleCancelEdit}>
            Cancel
          </Button>
        )}
        <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdateEventType} disabled={!formType.code || !formType.abbreviation || isLoading}>
          {editingType ? <Edit className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {editingType ? 'Update Type' : 'Add Type'}
        </Button>
      </div>

      <div className="rounded-md border border-border/70 p-0">
        <TableShell minWidthClassName="min-w-[560px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Abbr</TableHead>
                <TableHead>Track Attendance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventTypes.length === 0 && <EmptyTableRow colSpan={4} message="No event types yet." />}
              {eventTypes.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.code}</TableCell>
                  <TableCell>{item.abbreviation}</TableCell>
                  <TableCell>
                    <Badge variant={item.track_attendance ? 'default' : 'secondary'}>
                      {item.track_attendance ? 'Enabled' : 'Off'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit event type ${item.code}`}
                        onClick={() => handleEditType(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete event type ${item.code}`}
                        onClick={() => handleDeleteEventType(item.code)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </div>
    </div>
  );
};

const QuickAddTypeDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  onTypeAdded: (newType: CourseEventType) => void;
}> = ({ open, onOpenChange, courseId, onTypeAdded }) => {
  const [newType, setNewType] = React.useState({
    code: '',
    abbreviation: '',
    track_attendance: false,
  });
  const [isLoading, setIsLoading] = React.useState(false);

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const created = await scheduleService.createCourseEventType(courseId, newType);
      onTypeAdded(created);
      onOpenChange(false);
      setNewType({ code: '', abbreviation: '', track_attendance: false });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to create type.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Quick Add Event Type</DialogTitle>
          <DialogDescription>
            Add a new event type for your sections. Full settings available in the Settings tab.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quick-type-code">Type Name</Label>
            <Input
              id="quick-type-code"
              placeholder="e.g. Lab"
              value={newType.code}
              onChange={(e) => {
                const val = e.target.value;
                setNewType((prev) => {
                  const derived = deriveAbbreviationFromCode(val);
                  return {
                    ...prev,
                    code: val,
                    abbreviation: !prev.abbreviation || prev.abbreviation === deriveAbbreviationFromCode(prev.code) ? derived : prev.abbreviation,
                  };
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-type-abbr">Abbreviation</Label>
            <Input
              id="quick-type-abbr"
              placeholder="LB"
              value={newType.abbreviation}
              onChange={(e) => setNewType((prev) => ({ ...prev, abbreviation: e.target.value.toUpperCase() }))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleCreate} disabled={!newType.code || !newType.abbreviation || isLoading}>
            Create Type
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CourseSchedulePanel: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [eventTypes, setEventTypes] = React.useState<CourseEventType[]>([]);
  const [sections, setSections] = React.useState<CourseSection[]>([]);
  const [events, setEvents] = React.useState<CourseEvent[]>([]);

  const [isSectionFormOpen, setIsSectionFormOpen] = React.useState(false);
  const [isQuickAddTypeOpen, setIsQuickAddTypeOpen] = React.useState(false);
  const [editingSectionId, setEditingSectionId] = React.useState<string | null>(null);
  const [expandedSectionIds, setExpandedSectionIds] = React.useState<Set<string>>(new Set());

  const [formSection, setFormSection] = React.useState({
    sectionId: '',
    eventTypeCode: 'LECTURE',
    instructor: '',
    weekPattern: 'EVERY' as WeekPattern,
  });
  // Default start/end slots for new section
  const [formSlots, setFormSlots] = React.useState<SectionSlotDraft[]>([
    createSectionSlot(1, '09:00', '10:00'),
  ]);

  const termEndWeek = 1; // In a real app this might come from semester context

  const loadBaseData = React.useCallback(async () => {
    const [typeData, sectionData, eventData] = await Promise.all([
      scheduleService.getCourseEventTypes(courseId),
      scheduleService.getCourseSections(courseId),
      scheduleService.getCourseEvents(courseId),
    ]);
    setEventTypes(typeData);
    setSections(sectionData);
    setEvents(eventData);
  }, [courseId]);

  const reloadAll = React.useCallback(async () => {
    try {
      await loadBaseData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to load course schedule data.');
    }
  }, [loadBaseData]);

  React.useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Derived state: group events by section for display in the "Slots" column AND expandable list
  const eventsBySectionId = React.useMemo(() => {
    const map = new Map<string, CourseEvent[]>();
    events.forEach((ev) => {
      if (!ev.sectionId) return;
      const list = map.get(ev.sectionId) ?? [];
      list.push(ev);
      map.set(ev.sectionId, list);
    });
    // Sort events in each section
    map.forEach((list) => {
      list.sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime));
    });
    return map;
  }, [events]);

  const toggleSectionExpand = (secId: string) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(secId)) next.delete(secId);
      else next.add(secId);
      return next;
    });
  };

  const handleOpenCreate = () => {
    setEditingSectionId(null);
    setFormSection({
      sectionId: '',
      eventTypeCode: eventTypes[0]?.code || 'LECTURE',
      instructor: '',
      weekPattern: 'EVERY',
    });
    setFormSlots([createSectionSlot(1, '09:00', '10:00')]);
    setIsSectionFormOpen(true);
  };

  const handleOpenEdit = (section: CourseSection) => {
    setEditingSectionId(section.sectionId);
    setFormSection({
      sectionId: section.sectionId,
      eventTypeCode: section.eventTypeCode,
      instructor: section.instructor || '',
      weekPattern: section.weekPattern,
    });

    // Reconstruct slots from existing events for this section
    // We try to consolidate identical time/loc events if they exist, but for "Edit" we just take specific unique slots from events.
    // However, existing events might be many (one per week). We need to distill the "Pattern".
    // Since we don't store the "Pattern" slots separately in DB (only events), we must infer them.
    // Heuristic: Group by day/start/end/loc.
    const sectionEvents = eventsBySectionId.get(section.sectionId) ?? [];
    const uniqueSignatures = new Set<string>();
    const inferredSlots: SectionSlotDraft[] = [];

    sectionEvents.forEach((ev) => {
      const loc = extractLocationFromNote(ev.note) || '';
      const sig = `${ev.dayOfWeek}-${ev.startTime}-${ev.endTime}-${loc}`;
      if (!uniqueSignatures.has(sig)) {
        uniqueSignatures.add(sig);
        inferredSlots.push({
          id: slotId(),
          dayOfWeek: ev.dayOfWeek,
          startTime: ev.startTime,
          endTime: ev.endTime,
          location: loc,
        });
      }
    });

    // If no events found (weird), fallback to default
    if (inferredSlots.length === 0) {
      inferredSlots.push(createSectionSlot(section.dayOfWeek, section.startTime, section.endTime, section.location || ''));
    }

    setFormSlots(inferredSlots);
    setIsSectionFormOpen(true);
  };

  const currentNormalizedSlots = React.useMemo(() => {
    const normalized = formSlots.map((slot) => ({
      ...slot,
      startTime: toSafeTime(slot.startTime),
      endTime: toSafeTime(slot.endTime),
      dayOfWeek: clampMinute(Math.round(slot.dayOfWeek), 1, 7),
      location: slot.location.trim(),
    }));
    normalized.sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime));
    return normalized;
  }, [formSlots]);

  const handleSaveSection = async () => {
    if (currentNormalizedSlots.length === 0) {
      toast.error('Add at least one slot.');
      return;
    }
    if (!formSection.sectionId) {
      toast.error('Section ID is required.');
      return;
    }
    const invalidSlot = currentNormalizedSlots.find((slot) => !timeRangeIsValid(slot.startTime, slot.endTime));
    if (invalidSlot) {
      toast.error(`Invalid time range.`);
      return;
    }

    const uniqueSlots = currentNormalizedSlots.filter((slot, index, array) =>
      array.findIndex(
        (c) =>
          c.dayOfWeek === slot.dayOfWeek &&
          c.startTime === slot.startTime &&
          c.endTime === slot.endTime &&
          c.location === slot.location
      ) === index
    );

    try {
      const canonical = uniqueSlots[0];
      const commonData = {
        eventTypeCode: formSection.eventTypeCode,
        instructor: formSection.instructor || null,
        weekPattern: formSection.weekPattern,
        dayOfWeek: canonical.dayOfWeek,
        startTime: canonical.startTime,
        endTime: canonical.endTime,
        location: uniqueSlots.length === 1 ? canonical.location : 'Multiple locations',
        startWeek: 1,
        endWeek: termEndWeek,
      };

      const createEventsOps = uniqueSlots.map((slot) => ({
        op: 'create' as const,
        data: {
          eventTypeCode: formSection.eventTypeCode,
          sectionId: formSection.sectionId,
          title: null,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          weekPattern: formSection.weekPattern,
          startWeek: 1,
          endWeek: termEndWeek,
          enable: true,
          skip: false,
          note: buildEventNoteWithLocation(slot.location),
        },
      }));

      if (editingSectionId) {
        if (editingSectionId !== formSection.sectionId) {
          // RENAME SCENARIO: Delete old section -> Create new section -> Create new events
          await scheduleService.deleteCourseSection(courseId, editingSectionId);

          await scheduleService.createCourseSection(courseId, {
            sectionId: formSection.sectionId,
            ...commonData,
          });

          await scheduleService.batchCourseEvents(courseId, {
            atomic: true,
            items: createEventsOps,
          });
        } else {
          // UPDATE SCENARIO: Update metadata -> Replace events
          await scheduleService.updateCourseSection(courseId, editingSectionId, commonData);

          const existingEvents = eventsBySectionId.get(editingSectionId) ?? [];
          const deleteOps = existingEvents.map(e => ({ op: 'delete' as const, eventId: e.id }));

          await scheduleService.batchCourseEvents(courseId, {
            atomic: true,
            items: [...deleteOps, ...createEventsOps],
          });
        }
      } else {
        // CREATE SCENARIO
        await scheduleService.createCourseSection(courseId, {
          sectionId: formSection.sectionId,
          ...commonData,
        });

        await scheduleService.batchCourseEvents(courseId, {
          atomic: true,
          items: createEventsOps,
        });
      }

      setIsSectionFormOpen(false);
      await reloadAll();
      // No success toast
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to save section.');
    }
  };

  const handleDeleteSection = async (secId: string) => {
    try {
      await scheduleService.deleteCourseSection(courseId, secId);
      await reloadAll();
      // No success toast
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to delete section.');
    }
  };

  const handleToggleEventEnable = async (event: CourseEvent, checked: boolean) => {
    try {
      await scheduleService.updateCourseEvent(courseId, event.id, { enable: checked });
      // Optimistic update or reload? Reload is safer for consistency.
      // To avoid UI flicker, we could optimistically update local state too, but `reloadAll` is fast enough usually.
      await reloadAll();
      // No success toast
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to update event.');
    }
  };


  return (
    <div className="space-y-4">
      <div className="px-1">
        <PanelHeader
          title="Section List"
          description="Manage sections and their slots. Click on a section row to view and manage its individual events."
          right={
            <Button type="button" onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Section
            </Button>
          }
        />
      </div>

      <div className="rounded-md border border-border/70 p-0">
        <TableShell minWidthClassName="min-w-[760px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Recurrence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.length === 0 && <EmptyTableRow colSpan={6} message="No sections yet." />}
              {sections.map((section) => {
                const isExpanded = expandedSectionIds.has(section.sectionId);
                const sectionEvents = eventsBySectionId.get(section.sectionId) ?? [];
                // Summarize slots for display
                const uniqueSig = new Set<string>();
                const displaySlots: string[] = [];
                sectionEvents.forEach(e => {
                  const loc = extractLocationFromNote(e.note);
                  const sig = `${e.dayOfWeek}-${e.startTime}-${e.endTime}-${loc}`;
                  if (!uniqueSig.has(sig)) {
                    uniqueSig.add(sig);
                    displaySlots.push(`${dayLabel(e.dayOfWeek)} ${e.startTime}-${e.endTime}${loc ? ` @ ${loc}` : ''}`);
                  }
                });

                return (
                  <React.Fragment key={section.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleSectionExpand(section.sectionId)}
                    >
                      <TableCell>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium">{section.sectionId}</TableCell>
                      <TableCell>{section.eventTypeCode}</TableCell>
                      <TableCell>{section.instructor || '-'}</TableCell>
                      <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                        {displaySlots.join(', ') || 'No slots'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(section)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSection(section.sectionId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="p-0">
                          <Collapsible open={true}>
                            <CollapsibleContent className="p-4 pt-1">
                              <div className="rounded-md border bg-background">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-b-0 hover:bg-background">
                                      <TableHead className="h-9">Event</TableHead>
                                      <TableHead className="h-9">Time & Loc</TableHead>
                                      <TableHead className="h-9">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sectionEvents.map(event => (
                                      <TableRow key={event.id} className="border-b-0 hover:bg-muted/50">
                                        <TableCell className="py-2 font-medium">
                                          {event.eventTypeCode}
                                        </TableCell>
                                        <TableCell className="py-2">
                                          {dayLabel(event.dayOfWeek)} {event.startTime}-{event.endTime}
                                          {extractLocationFromNote(event.note) && <span className="ml-2 text-muted-foreground">@ {extractLocationFromNote(event.note)}</span>}
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <div className="flex items-center gap-2">
                                            <Checkbox
                                              id={`event-enable-${event.id}`}
                                              checked={event.enable}
                                              onCheckedChange={(c) => handleToggleEventEnable(event, asChecked(c))}
                                            />
                                            <Label htmlFor={`event-enable-${event.id}`} className="text-sm font-normal text-muted-foreground">
                                              {event.enable ? 'Active' : 'Ignored'}
                                            </Label>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableShell>
      </div>

      <Dialog open={isSectionFormOpen} onOpenChange={setIsSectionFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[840px]">
          <DialogHeader>
            <DialogTitle>{editingSectionId ? 'Edit Section' : 'Create Section'}</DialogTitle>
            <DialogDescription>
              {editingSectionId ? 'Update section details and slots. This will regenerate all events for this section.' : 'Configure a new section and its weekly slots.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Event Type</Label>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddTypeOpen(true)}
                    className="text-xs text-primary hover:underline hover:text-primary/80"
                  >
                    + Add Type
                  </button>
                </div>
                <Select
                  value={formSection.eventTypeCode}
                  onValueChange={(value) => setFormSection((prev) => ({ ...prev, eventTypeCode: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-section-id">Section Number</Label>
                <Input
                  id="new-section-id"
                  autoComplete="off"
                  placeholder="101"
                  inputMode="numeric"
                  // pattern="[0-9]*" // Removed strict pattern to allow alpha-numeric section codes if needed
                  value={formSection.sectionId}
                  onChange={(event) => setFormSection((prev) => ({ ...prev, sectionId: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-section-instructor">Instructor</Label>
                <Input
                  id="new-section-instructor"
                  autoComplete="off"
                  placeholder="Optional"
                  value={formSection.instructor}
                  onChange={(event) => setFormSection((prev) => ({ ...prev, instructor: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Pattern</Label>
                <Select
                  value={formSection.weekPattern}
                  onValueChange={(value) => setFormSection((prev) => ({ ...prev, weekPattern: value as WeekPattern }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEK_PATTERNS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Section Slots</Label>
              <SectionSlotPlanner
                slots={currentNormalizedSlots}
                onAddSlot={() => setFormSlots((prev) => [...prev, createSectionSlot()])}
                onUpdateSlot={(id, patch) => setFormSlots((prev) => prev.map(s => s.id === id ? { ...s, ...patch } : s))}
                onRemoveSlot={(id) => setFormSlots((prev) => prev.filter(s => s.id !== id))}
              />
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveSection} disabled={!formSection.sectionId}>
                {editingSectionId ? 'Save Changes' : 'Create Section'}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              Need to manage Event Types? Go to Settings tab.
            </div>

          </div>
        </DialogContent>
      </Dialog>

      <QuickAddTypeDialog
        open={isQuickAddTypeOpen}
        onOpenChange={setIsQuickAddTypeOpen}
        courseId={courseId}
        onTypeAdded={(created) => {
          // Refresh list and auto-select
          reloadAll();
          setFormSection(prev => ({ ...prev, eventTypeCode: created.code }));
        }}
      />
    </div>
  );
};

const SemesterSchedulePanel: React.FC<{ semesterId: string }> = ({ semesterId }) => {
  const [schedule, setSchedule] = React.useState<ScheduleItem[]>([]);
  const [week, setWeek] = React.useState(1);
  const [maxWeek, setMaxWeek] = React.useState(1);
  const [showSkipped, setShowSkipped] = React.useState(true);
  const [courseFilter, setCourseFilter] = React.useState('ALL');
  const [typeFilter, setTypeFilter] = React.useState('ALL');

  const loadSchedule = React.useCallback(async () => {
    try {
      const data = await scheduleService.getSemesterSchedule(semesterId, { week, withConflicts: true });
      setSchedule(data.items);
      setMaxWeek(data.maxWeek);
      if (week > data.maxWeek) setWeek(data.maxWeek);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to load semester schedule.');
    }
  }, [semesterId, week]);

  React.useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const filteredItems = React.useMemo(
    () =>
      schedule.filter((item) => {
        if (!showSkipped && item.skip) return false;
        if (courseFilter !== 'ALL' && item.courseId !== courseFilter) return false;
        if (typeFilter !== 'ALL' && item.eventTypeCode !== typeFilter) return false;
        return true;
      }),
    [courseFilter, schedule, showSkipped, typeFilter]
  );

  const courseOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    schedule.forEach((item) => map.set(item.courseId, item.courseName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [schedule]);

  const typeOptions = React.useMemo(() => Array.from(new Set(schedule.map((item) => item.eventTypeCode))), [schedule]);

  const handleExport = async (format: 'png' | 'pdf' | 'ics') => {
    try {
      const payload = {
        scope: 'semester' as const,
        scopeId: semesterId,
        range: 'week' as const,
        week,
        skipRenderMode: 'GRAY_SKIPPED' as const,
      };
      const result = await scheduleService.exportSchedule(format, payload);
      if (format === 'ics') {
        const blob = result as Blob;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `semester-${semesterId}-week-${week}.ics`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        // toast.success('ICS exported.'); // Removed
      } else {
        // toast.success(`${format.toUpperCase()} export prepared (${(result as any).itemCount} items).`); // Removed
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? `Failed to export ${format}.`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="px-1">
        <PanelHeader
          title="Semester Schedule"
          description="Filter by course and type, inspect conflicts, and export weekly schedule."
          right={
            <Button variant="outline" size="sm" onClick={loadSchedule}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">{filteredItems.length} Visible Events</Badge>
          <Badge variant="outline">Week {week}/{maxWeek}</Badge>
        </div>
      </div>

      <div className="space-y-4 p-6 pt-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filters & Export</CardTitle>
            <CardDescription>Apply filters before exporting the current week.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="semester-week">Week</Label>
                <Input
                  id="semester-week"
                  type="number"
                  min={1}
                  max={maxWeek}
                  value={week}
                  onChange={(event) => setWeek(Number(event.target.value || 1))}
                />
              </div>
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Courses</SelectItem>
                    {courseOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    {typeOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display</Label>
                <div className="flex h-9 items-center gap-2 rounded-md border px-3">
                  <Checkbox
                    id="semester-show-skipped"
                    checked={showSkipped}
                    onCheckedChange={(checked) => setShowSkipped(asChecked(checked))}
                  />
                  <Label htmlFor="semester-show-skipped" className="text-sm font-normal text-muted-foreground">
                    Show skipped
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Export</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleExport('png')}>
                    <Download className="mr-2 h-4 w-4" />
                    PNG
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleExport('ics')}>
                    <Download className="mr-2 h-4 w-4" />
                    ICS
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Week {week} / {maxWeek}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Semester Weekly Calendar</CardTitle>
            <CardDescription>Visual week layout by day and time.</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyCalendarView
              items={filteredItems}
              emptyMessage="No events matched the current filter."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Semester Weekly Schedule List</CardTitle>
            <CardDescription>Conflict groups are highlighted in red.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conflict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 && <EmptyTableRow colSpan={5} message="No events matched the current filter." />}
                {filteredItems.map((item) => (
                  <TableRow key={`${item.eventId}-${item.week}`}>
                    <TableCell className="font-medium">{item.courseName}</TableCell>
                    <TableCell>{item.eventTypeCode}</TableCell>
                    <TableCell>{dayLabel(item.dayOfWeek)} {item.startTime}-{item.endTime}</TableCell>
                    <TableCell>
                      {item.skip ? <Badge variant="secondary">Skipped</Badge> : <Badge>Active</Badge>}
                    </TableCell>
                    <TableCell>
                      {item.isConflict
                        ? <Badge variant="destructive">{item.conflictGroupId}</Badge>
                        : <Badge variant="outline">None</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const BuiltinAcademicTimetableTabComponent: React.FC<TabProps> = ({ courseId, semesterId }) => {
  if (courseId) return <CourseSchedulePanel courseId={courseId} />;
  if (semesterId) return <SemesterSchedulePanel semesterId={semesterId} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic Timetable</CardTitle>
        <CardDescription>No context available for this tab.</CardDescription>
      </CardHeader>
    </Card>
  );
};

const BuiltinAcademicTimetableSettingsComponent: React.FC<TabSettingsProps> = ({ courseId }) => {
  if (!courseId) return null;
  return <CourseEventTypeSettingsPanel courseId={courseId} />;
};

export const BuiltinAcademicTimetableTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_TAB_TYPE,
  name: 'Timetable',
  description: 'Academic timetable planner for course and semester schedules',
  icon: <CalendarDays className="h-4 w-4" />,
  component: BuiltinAcademicTimetableTabComponent,
  settingsComponent: BuiltinAcademicTimetableSettingsComponent,
  maxInstances: 1,
  allowedContexts: ['semester', 'course'],
};

// Backward-compatible alias for older schedule id references.
export const LegacyScheduleTabAliasDefinition: TabDefinition = {
  ...BuiltinAcademicTimetableTabDefinition,
  type: 'schedule',
  name: 'Timetable',
};

export const BuiltinAcademicTimetableTab = BuiltinAcademicTimetableTabComponent;
