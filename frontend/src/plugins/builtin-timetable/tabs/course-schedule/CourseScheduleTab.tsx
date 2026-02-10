import React from 'react';
import { ChevronDown, ChevronUp, Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
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
  type WeekPattern,
} from '@/services/schedule';
import { CrudPanel, EmptyTableRow, PanelHeader, TableShell } from '../../components/CrudPanel';
import { EventTypeFormDialog } from '../../components/EventTypeFormDialog';
import {
  DAY_OF_WEEK_OPTIONS,
  SLOT_LOCATION_NOTE_PREFIX,
  SectionFormDialog,
  createSectionSlot,
  formatHour,
  slotId,
  toMinutes,
  type SectionFormData,
  type SectionSlotDraft,
} from '../../components/SectionFormDialog';
import { timetableEventBus } from '../../shared/eventBus';
import { asChecked, extractLocationFromNote, getDayLabel, groupCourseEventsBySection } from '../../shared/utils';

const dayLabel = (value: number) => DAY_OF_WEEK_OPTIONS.find((item) => item.value === value)?.label ?? String(value);

const CourseEventTypeSettingsPanel: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [eventTypes, setEventTypes] = React.useState<CourseEventType[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [editingType, setEditingType] = React.useState<CourseEventType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const loadRequestIdRef = React.useRef(0);

  const loadEventTypes = React.useCallback(async () => {
    const loadRequestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = loadRequestId;

    setIsLoading(true);
    try {
      const typeData = await scheduleService.getCourseEventTypes(courseId);
      if (loadRequestIdRef.current !== loadRequestId) return;
      setEventTypes(typeData);
    } catch (err: any) {
      if (loadRequestIdRef.current !== loadRequestId) return;
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to load event types.');
    } finally {
      if (loadRequestIdRef.current === loadRequestId) {
        setIsLoading(false);
      }
    }
  }, [courseId]);

  React.useEffect(() => {
    void loadEventTypes();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadEventTypes]);

  const publishScheduleChange = React.useCallback((reason: 'event-type-created' | 'event-type-updated' | 'event-type-deleted') => {
    timetableEventBus.publish('timetable:schedule-data-changed', {
      source: 'course',
      reason,
      courseId,
    });
  }, [courseId]);

  const handleCreateOrUpdate = React.useCallback(async (data: { code: string; abbreviation: string; track_attendance: boolean }) => {
    try {
      if (editingType) {
        await scheduleService.updateCourseEventType(courseId, editingType.code, {
          code: data.code,
          abbreviation: data.abbreviation,
          trackAttendance: data.track_attendance,
        });
        publishScheduleChange('event-type-updated');
      } else {
        await scheduleService.createCourseEventType(courseId, data);
        publishScheduleChange('event-type-created');
      }

      await loadEventTypes();
      setEditingType(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to save event type.');
      throw err;
    }
  }, [courseId, editingType, loadEventTypes, publishScheduleChange]);

  React.useEffect(() => {
    if (!editingType) return;
    setIsDialogOpen(true);
  }, [editingType]);

  const handleOpenCreate = React.useCallback(() => {
    setEditingType(null);
    setIsDialogOpen(true);
  }, []);

  const handleDeleteEventType = React.useCallback(async (eventTypeCode: string) => {
    try {
      await scheduleService.deleteCourseEventType(courseId, eventTypeCode);
      publishScheduleChange('event-type-deleted');
      await loadEventTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to delete event type.');
    }
  }, [courseId, loadEventTypes, publishScheduleChange]);

  return (
    <>
      <CrudPanel
        title="Event Types"
        description="Manage the types of events available for this course (e.g., Lecture, Tutorial, Lab)."
        minWidthClassName="min-w-[560px]"
        items={eventTypes}
        isLoading={isLoading}
        actionButton={(
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Type
          </Button>
        )}
        renderHeader={() => (
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Abbr</TableHead>
            <TableHead>Track Attendance</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        )}
        renderRow={(item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.code}</TableCell>
            <TableCell>{item.abbreviation}</TableCell>
            <TableCell>
              <Badge variant={item.track_attendance ? 'default' : 'secondary'}>
                {item.track_attendance ? 'Yes' : 'No'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit event type ${item.code}`}
                  onClick={() => setEditingType(item)}
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
        )}
      />

      <EventTypeFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingType(null);
        }}
        initialData={editingType}
        onSubmit={handleCreateOrUpdate}
      />
    </>
  );
};

export const CourseScheduleTab: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [eventTypes, setEventTypes] = React.useState<CourseEventType[]>([]);
  const [sections, setSections] = React.useState<CourseSection[]>([]);
  const [events, setEvents] = React.useState<CourseEvent[]>([]);

  const [isSectionFormOpen, setIsSectionFormOpen] = React.useState(false);
  const [isQuickAddTypeOpen, setIsQuickAddTypeOpen] = React.useState(false);
  const [editingSectionId, setEditingSectionId] = React.useState<string | null>(null);
  const [expandedSectionIds, setExpandedSectionIds] = React.useState<Set<string>>(new Set());

  const [formSection, setFormSection] = React.useState<SectionFormData>({
    sectionId: '',
    eventTypeCode: 'LECTURE',
    instructor: '',
    weekPattern: 'EVERY' as WeekPattern,
  });
  const [formSlots, setFormSlots] = React.useState<SectionSlotDraft[]>([
    createSectionSlot(1, '09:00', '10:00'),
  ]);

  const loadRequestIdRef = React.useRef(0);

  const loadBaseData = React.useCallback(async () => {
    const loadRequestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = loadRequestId;

    try {
      const [typeData, sectionData, eventData] = await Promise.all([
        scheduleService.getCourseEventTypes(courseId),
        scheduleService.getCourseSections(courseId),
        scheduleService.getCourseEvents(courseId),
      ]);

      if (loadRequestIdRef.current !== loadRequestId) return;

      setEventTypes(typeData);
      setSections(sectionData);
      setEvents(eventData);
    } catch (err: any) {
      if (loadRequestIdRef.current !== loadRequestId) return;
      throw err;
    }
  }, [courseId]);

  const reloadAll = React.useCallback(async () => {
    try {
      await loadBaseData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to load course schedule data.');
    }
  }, [loadBaseData]);

  React.useEffect(() => {
    void reloadAll();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [reloadAll]);

  const eventsBySectionId = React.useMemo(() => groupCourseEventsBySection(events), [events]);

  const publishScheduleChange = React.useCallback(
    (reason: 'section-created' | 'section-updated' | 'section-deleted' | 'event-updated' | 'events-updated' | 'event-type-created') => {
      timetableEventBus.publish('timetable:schedule-data-changed', {
        source: 'course',
        reason,
        courseId,
      });
    },
    [courseId],
  );

  const toggleSectionExpand = React.useCallback((sectionId: string) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleOpenCreate = React.useCallback(() => {
    setEditingSectionId(null);
    setFormSection({
      sectionId: '',
      eventTypeCode: eventTypes[0]?.code || 'LECTURE',
      instructor: '',
      weekPattern: 'EVERY',
    });
    setFormSlots([createSectionSlot(1, '09:00', '10:00')]);
    setIsSectionFormOpen(true);
  }, [eventTypes]);

  const handleOpenEdit = React.useCallback((section: CourseSection) => {
    setEditingSectionId(section.sectionId);
    setFormSection({
      sectionId: section.sectionId,
      eventTypeCode: section.eventTypeCode,
      instructor: section.instructor || '',
      weekPattern: section.weekPattern,
    });

    const sectionEvents = eventsBySectionId.get(section.sectionId) ?? [];
    const uniqueSignatures = new Set<string>();
    const inferredSlots: SectionSlotDraft[] = [];

    for (const event of sectionEvents) {
      const location = extractLocationFromNote(event.note) || '';
      const signature = `${event.dayOfWeek}-${event.startTime}-${event.endTime}-${location}`;
      if (uniqueSignatures.has(signature)) continue;
      uniqueSignatures.add(signature);
      inferredSlots.push({
        id: slotId(),
        dayOfWeek: event.dayOfWeek,
        startTime: event.startTime,
        endTime: event.endTime,
        location,
      });
    }

    if (inferredSlots.length === 0) {
      inferredSlots.push(createSectionSlot(section.dayOfWeek, section.startTime, section.endTime, section.location || ''));
    }

    setFormSlots(inferredSlots);
    setIsSectionFormOpen(true);
  }, [eventsBySectionId]);

  const handleDeleteSection = React.useCallback(async (sectionId: string) => {
    try {
      await scheduleService.deleteCourseSection(courseId, sectionId);
      publishScheduleChange('section-deleted');
      await reloadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to delete section.');
    }
  }, [courseId, publishScheduleChange, reloadAll]);

  const handleToggleEventEnable = React.useCallback(async (event: CourseEvent, checked: boolean) => {
    try {
      await scheduleService.updateCourseEvent(courseId, event.id, { enable: checked });
      publishScheduleChange('event-updated');
      await reloadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to update event.');
    }
  }, [courseId, publishScheduleChange, reloadAll]);

  const handleToggleSectionEnable = React.useCallback(async (sectionId: string, enable: boolean) => {
    const sectionEvents = eventsBySectionId.get(sectionId) ?? [];
    if (sectionEvents.length === 0) return;

    try {
      await Promise.all(sectionEvents.map((event) => scheduleService.updateCourseEvent(courseId, event.id, { enable })));
      publishScheduleChange('events-updated');
      await reloadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to update section events.');
    }
  }, [courseId, eventsBySectionId, publishScheduleChange, reloadAll]);

  return (
    <div className="space-y-4 select-none">
      <div className="px-1">
        <PanelHeader
          title="Section List"
          description="Manage sections and their slots. Click on a section row to view and manage its individual events."
          right={(
            <Button type="button" onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Section
            </Button>
          )}
        />
      </div>

      <div className="rounded-md border border-border/70 p-0">
        <TableShell minWidthClassName="min-w-[760px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead className="w-[40px]">Status</TableHead>
                <TableHead>Section ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Recurrence</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.length === 0 && <EmptyTableRow colSpan={7} message="No sections yet." />}
              {sections.map((section) => {
                const isExpanded = expandedSectionIds.has(section.sectionId);
                const sectionEvents = eventsBySectionId.get(section.sectionId) ?? [];
                const uniqueSignatures = new Set<string>();
                const displaySlots: string[] = [];

                for (const event of sectionEvents) {
                  const location = extractLocationFromNote(event.note);
                  const signature = `${event.dayOfWeek}-${event.startTime}-${event.endTime}-${location}`;
                  if (uniqueSignatures.has(signature)) continue;
                  uniqueSignatures.add(signature);
                  displaySlots.push(`${dayLabel(event.dayOfWeek)} ${event.startTime}-${event.endTime}${location ? ` @ ${location}` : ''}`);
                }

                const allEnabled = sectionEvents.every((event) => event.enable);
                const someEnabled = sectionEvents.some((event) => event.enable);
                const isIndeterminate = someEnabled && !allEnabled;

                return (
                  <React.Fragment key={section.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleSectionExpand(section.sectionId)}
                    >
                      <TableCell>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={allEnabled ? true : isIndeterminate ? 'indeterminate' : false}
                          onCheckedChange={(checked) => handleToggleSectionEnable(section.sectionId, asChecked(checked))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{section.sectionId}</TableCell>
                      <TableCell>{section.eventTypeCode}</TableCell>
                      <TableCell>{section.instructor || '-'}</TableCell>
                      <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                        {displaySlots.join(', ') || 'No slots'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit section ${section.sectionId}`}
                            onClick={() => handleOpenEdit(section)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete section ${section.sectionId}`}
                            onClick={() => handleDeleteSection(section.sectionId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-0">
                          <Collapsible open>
                            <CollapsibleContent className="p-4">
                              <div className="rounded-md border bg-background py-1">
                                {sectionEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                                  >
                                    <Checkbox
                                      id={`event-enable-${event.id}`}
                                      checked={event.enable}
                                      onCheckedChange={(checked) => handleToggleEventEnable(event, asChecked(checked))}
                                    />
                                    <div className="grid flex-1 grid-cols-[100px_180px_1fr] items-center gap-2">
                                      <span className="font-medium">{event.eventTypeCode}</span>
                                      <span>
                                        {getDayLabel(event.dayOfWeek)} {event.startTime}-{event.endTime}
                                      </span>
                                      <span className="truncate text-muted-foreground">
                                        {extractLocationFromNote(event.note) || '-'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
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

      <SectionFormDialog
        open={isSectionFormOpen}
        onOpenChange={setIsSectionFormOpen}
        courseId={courseId}
        editingSectionId={editingSectionId}
        initialData={formSection}
        initialSlots={formSlots}
        eventTypes={eventTypes}
        existingEvents={events}
        onOpenQuickAddType={() => setIsQuickAddTypeOpen(true)}
        onSuccess={async () => {
          publishScheduleChange(editingSectionId ? 'section-updated' : 'section-created');
          await reloadAll();
        }}
      />

      <EventTypeFormDialog
        open={isQuickAddTypeOpen}
        onOpenChange={setIsQuickAddTypeOpen}
        title="Quick Add Event Type"
        confirmLabel="Create Type"
        description="Define a new event type. Manage all types in Settings."
        onSubmit={async (data) => {
          const created = await scheduleService.createCourseEventType(courseId, data);
          publishScheduleChange('event-type-created');
          await reloadAll();
          setFormSection((previous) => ({ ...previous, eventTypeCode: created.code }));
        }}
      />
    </div>
  );
};

export const CourseScheduleSettings: React.FC<{ courseId: string }> = ({ courseId }) => {
  return <CourseEventTypeSettingsPanel courseId={courseId} />;
};

// Keep a direct export for plugin-internal migration compatibility.
export const extractLocationFromScheduleNote = (note?: string | null) => {
  if (!note || !note.startsWith(SLOT_LOCATION_NOTE_PREFIX)) return null;
  const firstLine = note.slice(SLOT_LOCATION_NOTE_PREFIX.length).split('\n')[0];
  return firstLine.trim() || null;
};

// Keep a direct export for plugin-internal migration compatibility.
export const formatCalendarHour = (minutes: number) => formatHour(minutes);

// Keep a direct export for plugin-internal migration compatibility.
export const toCalendarMinutes = (value: string) => toMinutes(value);
