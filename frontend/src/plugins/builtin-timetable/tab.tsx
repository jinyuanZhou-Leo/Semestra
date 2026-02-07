import React from 'react';
import { CalendarClock, CalendarDays, Download, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  Tabs as UiTabs,
  TabsContent as UiTabsContent,
  TabsList as UiTabsList,
  TabsTrigger as UiTabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

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

const asChecked = (value: boolean | 'indeterminate') => value === true;
const dayLabel = (value: number) => DAY_OF_WEEK_OPTIONS.find((item) => item.value === value)?.label ?? String(value);
const formatDayList = (days: number[]) =>
  days
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort((a, b) => a - b)
    .map(dayLabel)
    .join(', ');
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

const InlineNotice: React.FC<{ tone: 'error' | 'success'; message: string }> = ({ tone, message }) => (
  <div
    className={
      tone === 'error'
        ? 'rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600'
        : 'rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700'
    }
  >
    {message}
  </div>
);

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

const CourseSchedulePanel: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [eventTypes, setEventTypes] = React.useState<CourseEventType[]>([]);
  const [sections, setSections] = React.useState<CourseSection[]>([]);
  const [events, setEvents] = React.useState<CourseEvent[]>([]);
  const [schedule, setSchedule] = React.useState<ScheduleItem[]>([]);
  const [week, setWeek] = React.useState(1);
  const [maxWeek, setMaxWeek] = React.useState(1);
  const [showSkipped, setShowSkipped] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [newType, setNewType] = React.useState({
    code: '',
    abbreviation: '',
    track_attendance: false,
  });
  const [newSection, setNewSection] = React.useState({
    sectionId: '',
    eventTypeCode: 'LECTURE',
    title: '',
    instructor: '',
    location: '',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:00',
    weekPattern: 'EVERY' as WeekPattern,
    startWeek: 1,
    endWeek: 1,
  });
  const [newSectionDays, setNewSectionDays] = React.useState<number[]>([1]);

  const trackAttendanceMap = React.useMemo(
    () => Object.fromEntries(eventTypes.map((item) => [item.code, item.track_attendance])),
    [eventTypes]
  );

  const visibleSchedule = React.useMemo(() => {
    if (showSkipped) return schedule;
    return schedule.filter((item) => !item.skip);
  }, [schedule, showSkipped]);

  const termEndWeek = Math.max(maxWeek, 1);

  const sectionDaysById = React.useMemo(() => {
    const map = new Map<string, number[]>();
    events.forEach((event) => {
      if (!event.sectionId) return;
      const existing = map.get(event.sectionId) ?? [];
      if (!existing.includes(event.dayOfWeek)) {
        existing.push(event.dayOfWeek);
        map.set(event.sectionId, existing);
      }
    });
    map.forEach((days, key) => map.set(key, days.sort((a, b) => a - b)));
    return map;
  }, [events]);

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

  const loadSchedule = React.useCallback(async () => {
    const data = await scheduleService.getCourseSchedule(courseId, { week, withConflicts: true });
    setSchedule(data.items);
    setMaxWeek(data.maxWeek);
    if (week > data.maxWeek) setWeek(data.maxWeek);
  }, [courseId, week]);

  const reloadAll = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loadBaseData();
      await loadSchedule();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to load course schedule data.');
    } finally {
      setIsLoading(false);
    }
  }, [loadBaseData, loadSchedule]);

  React.useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  React.useEffect(() => {
    loadSchedule().catch((err: any) => {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to load course schedule.');
    });
  }, [loadSchedule]);

  React.useEffect(() => {
    setNewSection((prev) => ({ ...prev, startWeek: 1, endWeek: termEndWeek }));
  }, [termEndWeek]);

  const resetNotice = () => {
    setError(null);
    setMessage(null);
  };

  const handleCreateEventType = async () => {
    resetNotice();
    try {
      await scheduleService.createCourseEventType(courseId, newType);
      setNewType({ code: '', abbreviation: '', track_attendance: false });
      await reloadAll();
      setMessage('Event type created.');
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to create event type.');
    }
  };

  const handleToggleTrack = async (eventType: CourseEventType, checked: boolean) => {
    resetNotice();
    try {
      const result = await scheduleService.updateCourseEventType(courseId, eventType.code, {
        trackAttendance: checked,
      });
      await reloadAll();
      setMessage(
        result.normalized_events > 0
          ? `Normalized ${result.normalized_events} event(s) to skip=false.`
          : 'Event type updated.'
      );
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to update event type.');
    }
  };

  const handleDeleteEventType = async (eventTypeCode: string) => {
    resetNotice();
    try {
      await scheduleService.deleteCourseEventType(courseId, eventTypeCode);
      await reloadAll();
      setMessage('Event type deleted.');
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to delete event type.');
    }
  };

  const handleCreateSection = async () => {
    resetNotice();
    if (newSectionDays.length === 0) {
      setError('Pick at least one day for this section.');
      return;
    }
    if (eventTypes.length === 0) {
      setError('Create an event type first, then add a section.');
      return;
    }
    try {
      const canonicalDay = Math.min(...newSectionDays);
      await scheduleService.createCourseSection(courseId, {
        ...newSection,
        dayOfWeek: canonicalDay,
        startWeek: 1,
        endWeek: termEndWeek,
      });
      await scheduleService.batchCourseEvents(courseId, {
        atomic: true,
        items: newSectionDays.map((dayOfWeek) => ({
          op: 'create' as const,
          data: {
            eventTypeCode: newSection.eventTypeCode,
            sectionId: newSection.sectionId,
            title: newSection.title || null,
            dayOfWeek,
            startTime: newSection.startTime,
            endTime: newSection.endTime,
            weekPattern: newSection.weekPattern,
            startWeek: 1,
            endWeek: termEndWeek,
            enable: true,
            skip: false,
            note: null,
          },
        })),
      });
      setNewSection((prev) => ({ ...prev, sectionId: '', title: '', instructor: '', location: '' }));
      setNewSectionDays([1]);
      await reloadAll();
      setMessage(`Section created with ${newSectionDays.length} weekly event(s).`);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to create section.');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    resetNotice();
    try {
      await scheduleService.deleteCourseSection(courseId, sectionId);
      await reloadAll();
      setMessage('Section deleted.');
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to delete section.');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    resetNotice();
    try {
      await scheduleService.deleteCourseEvent(courseId, eventId);
      await reloadAll();
      setMessage('Event deleted.');
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to delete event.');
    }
  };

  const handleEventToggle = async (event: CourseEvent, key: 'enable' | 'skip', checked: boolean) => {
    resetNotice();
    try {
      await scheduleService.updateCourseEvent(courseId, event.id, { [key]: checked });
      await reloadAll();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to update event.');
    }
  };

  const handleExport = async (format: 'png' | 'pdf' | 'ics') => {
    resetNotice();
    try {
      const payload = {
        scope: 'course' as const,
        scopeId: courseId,
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
        anchor.download = `course-${courseId}-week-${week}.ics`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setMessage('ICS exported.');
      } else {
        setMessage(`${format.toUpperCase()} export prepared (${(result as any).itemCount} items).`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? `Failed to export ${format}.`);
    }
  };

  return (
    <Card className="border border-border/70">
      <CardHeader className="space-y-4">
        <PanelHeader
          title="Course Schedule Core"
          description="Manage event types, sections, events, and the generated weekly schedule."
          right={
            <Button variant="outline" size="sm" onClick={reloadAll} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{eventTypes.length} Event Types</Badge>
          <Badge variant="outline">{sections.length} Sections</Badge>
          <Badge variant="outline">{events.length} Events</Badge>
          <Badge variant="outline">Week {week}/{maxWeek}</Badge>
        </div>
        {error && <InlineNotice tone="error" message={error} />}
        {message && <InlineNotice tone="success" message={message} />}
      </CardHeader>

      <CardContent className="space-y-4">
        <UiTabs defaultValue="event-types" className="flex flex-col gap-4">
          <UiTabsList className="h-10 w-full self-start justify-start overflow-x-auto whitespace-nowrap pb-1" variant="line">
            <UiTabsTrigger value="event-types">Event Types</UiTabsTrigger>
            <UiTabsTrigger value="sections">Sections</UiTabsTrigger>
            <UiTabsTrigger value="events">Events</UiTabsTrigger>
            <UiTabsTrigger value="schedule">Schedule</UiTabsTrigger>
          </UiTabsList>

          <UiTabsContent value="event-types" className="space-y-4">
            <div className="grid items-start gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-5">
                <CardHeader>
                  <CardTitle className="text-sm">Create Event Type</CardTitle>
                  <CardDescription>Add a custom type for this course.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-type-code">Code</Label>
                      <Input
                        id="new-type-code"
                        name="new_type_code"
                        autoComplete="off"
                        placeholder="WORKSHOP"
                        value={newType.code}
                        onChange={(event) => {
                          const nextCode = event.target.value.toUpperCase();
                          setNewType((prev) => {
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
                      <Label htmlFor="new-type-abbr">Abbreviation</Label>
                      <Input
                        id="new-type-abbr"
                        name="new_type_abbreviation"
                        autoComplete="off"
                        placeholder="WS"
                        value={newType.abbreviation}
                        onChange={(event) => setNewType((prev) => ({ ...prev, abbreviation: event.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Checkbox
                      id="new-type-track"
                      checked={newType.track_attendance}
                      onCheckedChange={(checked) => setNewType((prev) => ({ ...prev, track_attendance: asChecked(checked) }))}
                    />
                    <Label htmlFor="new-type-track" className="text-sm font-normal text-muted-foreground">
                      Track attendance (forces `skip=false`)
                    </Label>
                  </div>
                  <Button className="w-full" onClick={handleCreateEventType} disabled={!newType.code || !newType.abbreviation}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Type
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-7">
                <CardHeader>
                  <CardTitle className="text-sm">Event Type List</CardTitle>
                  <CardDescription>Toggle attendance tracking or remove a type.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TableShell minWidthClassName="min-w-[560px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
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
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`track-${item.id}`}
                                  checked={item.track_attendance}
                                  onCheckedChange={(checked) => handleToggleTrack(item, asChecked(checked))}
                                />
                                <Label htmlFor={`track-${item.id}`} className="text-xs font-normal text-muted-foreground">
                                  {item.track_attendance ? 'Enabled' : 'Off'}
                                </Label>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete event type ${item.code}`}
                                onClick={() => handleDeleteEventType(item.code)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableShell>
                </CardContent>
              </Card>
            </div>
          </UiTabsContent>

          <UiTabsContent value="sections" className="space-y-4">
            <div className="grid items-start gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-5">
                <CardHeader>
                  <CardTitle className="text-sm">Create Section</CardTitle>
                  <CardDescription>Add a section source that can be bound to events.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-section-id">Section Number</Label>
                    <Input
                      id="new-section-id"
                      name="new_section_id"
                      autoComplete="off"
                      placeholder="101"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newSection.sectionId}
                      onChange={(event) => {
                        const nextSectionId = event.target.value.replace(/\D/g, '');
                        setNewSection((prev) => ({ ...prev, sectionId: nextSectionId }));
                      }}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="new-section-title">Title</Label>
                      <Input
                        id="new-section-title"
                        name="new_section_title"
                        autoComplete="off"
                        placeholder="Optional title"
                        value={newSection.title}
                        onChange={(event) => setNewSection((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-section-instructor">Instructor</Label>
                      <Input
                        id="new-section-instructor"
                        name="new_section_instructor"
                        autoComplete="off"
                        placeholder="Optional instructor"
                        value={newSection.instructor}
                        onChange={(event) => setNewSection((prev) => ({ ...prev, instructor: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-section-location">Location</Label>
                      <Input
                        id="new-section-location"
                        name="new_section_location"
                        autoComplete="off"
                        placeholder="Optional location"
                        value={newSection.location}
                        onChange={(event) => setNewSection((prev) => ({ ...prev, location: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Event Type</Label>
                      <Select
                        value={newSection.eventTypeCode}
                        onValueChange={(value) => setNewSection((prev) => ({ ...prev, eventTypeCode: value }))}
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
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Days</Label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {DAY_OF_WEEK_OPTIONS.map((item) => {
                          const selected = newSectionDays.includes(item.value);
                          return (
                            <label
                              key={item.value}
                              className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-sm"
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(checked) => {
                                  const nextChecked = asChecked(checked);
                                  setNewSectionDays((prev) => {
                                    if (nextChecked) return [...new Set([...prev, item.value])].sort((a, b) => a - b);
                                    return prev.filter((value) => value !== item.value);
                                  });
                                }}
                              />
                              <span>{item.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        step={300}
                        name="new_section_start_time"
                        autoComplete="off"
                        value={newSection.startTime}
                        onChange={(event) => setNewSection((prev) => ({ ...prev, startTime: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        step={300}
                        name="new_section_end_time"
                        autoComplete="off"
                        value={newSection.endTime}
                        onChange={(event) => setNewSection((prev) => ({ ...prev, endTime: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pattern</Label>
                      <Select
                        value={newSection.weekPattern}
                        onValueChange={(value) => setNewSection((prev) => ({ ...prev, weekPattern: value as WeekPattern }))}
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
                  <Button className="w-full" onClick={handleCreateSection} disabled={!newSection.sectionId}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Section
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-7">
                <CardHeader>
                  <CardTitle className="text-sm">Section List</CardTitle>
                  <CardDescription>Each section can be linked from one or multiple events.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TableShell minWidthClassName="min-w-[640px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Section</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Slot</TableHead>
                          <TableHead>Weeks</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sections.length === 0 && <EmptyTableRow colSpan={5} message="No sections yet." />}
                        {sections.map((section) => (
                          <TableRow key={section.id}>
                            <TableCell className="font-medium">{section.sectionId}</TableCell>
                            <TableCell>{section.eventTypeCode}</TableCell>
                          <TableCell>
                            {formatDayList(sectionDaysById.get(section.sectionId) ?? [section.dayOfWeek])} {section.startTime}-{section.endTime}
                          </TableCell>
                            <TableCell>{section.weekPattern} / {section.startWeek}-{section.endWeek}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete section ${section.sectionId}`}
                                onClick={() => handleDeleteSection(section.sectionId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableShell>
                </CardContent>
              </Card>
            </div>
          </UiTabsContent>

          <UiTabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Event List</CardTitle>
                <CardDescription>
                  Events are generated from sections. You can still toggle enable/skip and delete.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TableShell minWidthClassName="min-w-[760px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Slot</TableHead>
                        <TableHead>Weeks</TableHead>
                        <TableHead>Enable</TableHead>
                        <TableHead>Skip</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.length === 0 && <EmptyTableRow colSpan={7} message="No events yet." />}
                      {events.map((event) => {
                        const lockSkip = trackAttendanceMap[event.eventTypeCode] ?? false;
                        return (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.eventTypeCode}</TableCell>
                            <TableCell>{event.sectionId ?? 'Manual'}</TableCell>
                            <TableCell>{dayLabel(event.dayOfWeek)} {event.startTime}-{event.endTime}</TableCell>
                            <TableCell>{event.weekPattern} / {event.startWeek ?? 1}-{event.endWeek ?? 'Term'}</TableCell>
                            <TableCell>
                              <Checkbox
                                id={`event-enable-${event.id}`}
                                checked={event.enable}
                                onCheckedChange={(checked) => handleEventToggle(event, 'enable', asChecked(checked))}
                              />
                            </TableCell>
                            <TableCell>
                              <Checkbox
                                id={`event-skip-${event.id}`}
                                checked={event.skip}
                                disabled={lockSkip}
                                onCheckedChange={(checked) => handleEventToggle(event, 'skip', asChecked(checked))}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete event ${event.id}`}
                                onClick={() => handleDeleteEvent(event.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableShell>
              </CardContent>
            </Card>
          </UiTabsContent>

          <UiTabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Schedule Controls</CardTitle>
                <CardDescription>Preview one week and export in selected format.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[160px_220px_minmax(0,1fr)] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="course-schedule-week">Week</Label>
                    <Input
                      id="course-schedule-week"
                      type="number"
                      min={1}
                      max={maxWeek}
                      className="max-w-[10rem]"
                      value={week}
                      onChange={(event) => setWeek(Number(event.target.value || 1))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Display</Label>
                    <div className="flex h-9 items-center gap-2 rounded-md border px-3">
                      <Checkbox
                        id="course-show-skipped"
                        checked={showSkipped}
                        onCheckedChange={(checked) => setShowSkipped(asChecked(checked))}
                      />
                      <Label htmlFor="course-show-skipped" className="text-sm font-normal text-muted-foreground">
                        Show skipped
                      </Label>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Export</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => handleExport('png')}>
                        <Download className="mr-2 h-4 w-4" />
                        PNG
                      </Button>
                      <Button variant="outline" onClick={() => handleExport('pdf')}>
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Button variant="outline" onClick={() => handleExport('ics')}>
                        <Download className="mr-2 h-4 w-4" />
                        ICS
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  Week {week} / {maxWeek}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Weekly Calendar View</CardTitle>
                <CardDescription>Visual week layout by day and time.</CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklyCalendarView
                  items={visibleSchedule}
                  emptyMessage="No schedule items for this week."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Weekly Schedule List</CardTitle>
                <CardDescription>Conflict labels only apply to active non-skipped events.</CardDescription>
              </CardHeader>
              <CardContent>
                <TableShell minWidthClassName="min-w-[680px]">
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
                      {visibleSchedule.length === 0 && <EmptyTableRow colSpan={5} message="No schedule items for this week." />}
                      {visibleSchedule.map((item) => (
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
                </TableShell>
              </CardContent>
            </Card>
          </UiTabsContent>
        </UiTabs>
      </CardContent>
    </Card>
  );
};

const SemesterSchedulePanel: React.FC<{ semesterId: string }> = ({ semesterId }) => {
  const [schedule, setSchedule] = React.useState<ScheduleItem[]>([]);
  const [week, setWeek] = React.useState(1);
  const [maxWeek, setMaxWeek] = React.useState(1);
  const [showSkipped, setShowSkipped] = React.useState(true);
  const [courseFilter, setCourseFilter] = React.useState('ALL');
  const [typeFilter, setTypeFilter] = React.useState('ALL');
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadSchedule = React.useCallback(async () => {
    setError(null);
    try {
      const data = await scheduleService.getSemesterSchedule(semesterId, { week, withConflicts: true });
      setSchedule(data.items);
      setMaxWeek(data.maxWeek);
      if (week > data.maxWeek) setWeek(data.maxWeek);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to load semester schedule.');
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
    setError(null);
    setMessage(null);
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
        setMessage('ICS exported.');
      } else {
        setMessage(`${format.toUpperCase()} export prepared (${(result as any).itemCount} items).`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? `Failed to export ${format}.`);
    }
  };

  return (
    <Card className="border border-border/70">
      <CardHeader className="space-y-4">
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
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{filteredItems.length} Visible Events</Badge>
          <Badge variant="outline">Week {week}/{maxWeek}</Badge>
        </div>
        {error && <InlineNotice tone="error" message={error} />}
        {message && <InlineNotice tone="success" message={message} />}
      </CardHeader>

      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
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

export const BuiltinAcademicTimetableTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_TAB_TYPE,
  name: 'Timetable',
  description: 'Academic timetable planner for course and semester schedules',
  icon: <CalendarDays className="h-4 w-4" />,
  component: BuiltinAcademicTimetableTabComponent,
  maxInstances: 0,
  allowedContexts: ['semester', 'course'],
};

// Backward-compatible alias for older schedule id references.
export const LegacyScheduleTabAliasDefinition: TabDefinition = {
  ...BuiltinAcademicTimetableTabDefinition,
  type: 'schedule',
  name: 'Timetable',
};

export const BuiltinAcademicTimetableTab = BuiltinAcademicTimetableTabComponent;
