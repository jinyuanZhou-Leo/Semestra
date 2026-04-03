// input:  [course or semester context, course/event-type APIs, generic tab-settings APIs, shared timetable event bus, settings data-table UI, and shared row-actions dropdown helpers]
// output: [`CourseScheduleSettings` settings panel for semester or course event-type management]
// pos:    [Event-type settings surface that edits builtin-event-core event-type definitions from the shared settings bucket, keeps data tables mobile-safe with an explicit four-column minimum width, and publishes course schedule refresh events when course-scoped definitions change]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { SettingsSection } from '@/components/SettingsSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import scheduleService, { type CourseEventType } from '@/services/schedule';
import { DataTable, DataTableActionMenu } from '@/components/DataTable';
import { EventTypeFormDialog } from '../../components/EventTypeFormDialog';
import { publishTimetableScheduleChange } from '../../shared/publishTimetableScheduleChange';

interface CourseScheduleSettingsProps {
  courseId?: string;
  semesterId?: string;
}

const EVENT_CORE_SETTINGS_KEY = 'builtin-event-core';
const EVENT_CORE_EVENT_TYPES_FIELD = 'eventTypes';
const COURSE_SCHEDULE_SECTION_DESCRIPTION = 'Manage the event types available for course schedules, including their labels and attendance tracking.';
const COURSE_SCHEDULE_EVENT_TYPES_DESCRIPTION = 'Manage the event types available for course schedules (e.g., Lecture, Tutorial, Lab).';
const DEFAULT_EVENT_TYPES: CourseEventType[] = [
  { id: 'builtin-lecture', code: 'LECTURE', abbreviation: 'LEC', track_attendance: false, color: null, icon: null },
  { id: 'builtin-practical', code: 'PRACTICAL', abbreviation: 'PRA', track_attendance: false, color: null, icon: null },
  { id: 'builtin-tutorial', code: 'TUTORIAL', abbreviation: 'TUT', track_attendance: false, color: null, icon: null },
];

const normalizeEventTypes = (value: unknown): CourseEventType[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_EVENT_TYPES;
  }
  const normalized = value.flatMap((item, index) => {
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code.trim().toUpperCase() : '';
    const abbreviation = typeof record.abbreviation === 'string' ? record.abbreviation.trim().toUpperCase() : '';
    if (!code || !abbreviation) return [];
    return [{
      id: typeof record.id === 'string' ? record.id : `${code}-${index}`,
      code,
      abbreviation,
      track_attendance: Boolean(record.track_attendance),
      color: typeof record.color === 'string' ? record.color : null,
      icon: typeof record.icon === 'string' ? record.icon : null,
    }];
  });
  return normalized.length > 0 ? normalized : DEFAULT_EVENT_TYPES;
};

const serializeEventTypes = (items: CourseEventType[]) => items.map((item) => ({
  id: item.id,
  code: item.code,
  abbreviation: item.abbreviation,
  track_attendance: item.track_attendance,
  color: item.color ?? null,
  icon: item.icon ?? null,
}));

const getSemesterEventCoreScopeSettings = async (semesterId: string) => {
  const entry = (await api.getSemesterTabSettings(semesterId))
    .find((tabSetting) => tabSetting.settings_key === EVENT_CORE_SETTINGS_KEY);
  if (!entry || typeof entry.scope_settings !== 'object' || entry.scope_settings === null) {
    return {};
  }
  return entry.scope_settings;
};

export const CourseScheduleSettings: React.FC<CourseScheduleSettingsProps> = ({ courseId, semesterId }) => {
  const scopeKind = courseId ? 'course' : semesterId ? 'semester' : null;
  const [eventTypes, setEventTypes] = React.useState<CourseEventType[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [editingType, setEditingType] = React.useState<CourseEventType | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = React.useState<CourseEventType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [resolvedSemesterId, setResolvedSemesterId] = React.useState<string | undefined>(semesterId);
  const loadRequestIdRef = React.useRef(0);

  const loadEventTypes = React.useCallback(async () => {
    if (!scopeKind) return;
    const loadRequestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = loadRequestId;

    setIsLoading(true);
    try {
      const typeData = scopeKind === 'course' && courseId
        ? await scheduleService.getCourseEventTypes(courseId)
        : normalizeEventTypes(
          (await api.getSemesterTabSettings(resolvedSemesterId!))
            .find((entry) => entry.settings_key === EVENT_CORE_SETTINGS_KEY)
            ?.resolved_settings?.[EVENT_CORE_EVENT_TYPES_FIELD],
        );
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
  }, [courseId, resolvedSemesterId, scopeKind]);

  React.useEffect(() => {
    void loadEventTypes();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadEventTypes]);

  React.useEffect(() => {
    let cancelled = false;

    if (!courseId) {
      setResolvedSemesterId(semesterId ?? undefined);
      return () => {
        cancelled = true;
      };
    }

    api.getCourse(courseId)
      .then((course) => {
        if (cancelled) return;
        setResolvedSemesterId(course.semester_id ?? undefined);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedSemesterId(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, semesterId]);

  const publishScheduleChange = React.useCallback(async (
    reason: 'event-type-created' | 'event-type-updated' | 'event-type-deleted',
  ) => {
    await publishTimetableScheduleChange({
      source: 'course',
      reason,
      courseId,
      semesterId,
    });
  }, [courseId, semesterId]);

  const handleCreateOrUpdate = React.useCallback(async (data: { code: string; abbreviation: string; track_attendance: boolean }) => {
    if (!scopeKind) return;
    try {
      if (scopeKind === 'course' && courseId) {
        if (editingType) {
          await scheduleService.updateCourseEventType(courseId, editingType.code, {
            code: data.code,
            abbreviation: data.abbreviation,
            trackAttendance: data.track_attendance,
          });
          await publishScheduleChange('event-type-updated');
        } else {
          await scheduleService.createCourseEventType(courseId, data);
          await publishScheduleChange('event-type-created');
        }
      } else {
        const nextItems = editingType
          ? eventTypes.map((item) => item.id === editingType.id ? { ...item, ...data } : item)
          : [
            ...eventTypes,
            {
              id: data.code.trim().toUpperCase(),
              code: data.code.trim().toUpperCase(),
              abbreviation: data.abbreviation.trim().toUpperCase(),
              track_attendance: data.track_attendance,
              color: null,
              icon: null,
            },
          ];
        const currentScopeSettings = await getSemesterEventCoreScopeSettings(resolvedSemesterId!);
        await api.upsertSemesterTabSettings(resolvedSemesterId!, EVENT_CORE_SETTINGS_KEY, {
          settings: JSON.stringify({
            ...currentScopeSettings,
            [EVENT_CORE_EVENT_TYPES_FIELD]: serializeEventTypes(nextItems),
          }),
        });
      }

      await loadEventTypes();
      setEditingType(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to save event type.');
      throw err;
    }
  }, [courseId, editingType, eventTypes, loadEventTypes, publishScheduleChange, resolvedSemesterId, scopeKind]);

  React.useEffect(() => {
    if (!editingType) return;
    setIsDialogOpen(true);
  }, [editingType]);

  const handleOpenCreate = React.useCallback(() => {
    setEditingType(null);
    setIsDialogOpen(true);
  }, []);

  const handleDeleteEventType = React.useCallback(async (eventTypeCode: string) => {
    if (!scopeKind) return;
    try {
      if (scopeKind === 'course' && courseId) {
        await scheduleService.deleteCourseEventType(courseId, eventTypeCode);
        await publishScheduleChange('event-type-deleted');
      } else {
        const currentScopeSettings = await getSemesterEventCoreScopeSettings(resolvedSemesterId!);
        await api.upsertSemesterTabSettings(resolvedSemesterId!, EVENT_CORE_SETTINGS_KEY, {
          settings: JSON.stringify({
            ...currentScopeSettings,
            [EVENT_CORE_EVENT_TYPES_FIELD]: serializeEventTypes(
              eventTypes.filter((item) => item.code !== eventTypeCode),
            ),
          }),
        });
      }
      await loadEventTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to delete event type.');
    }
  }, [courseId, eventTypes, loadEventTypes, publishScheduleChange, resolvedSemesterId, scopeKind]);

  return (
    <>
      <SettingsSection
        title="Course Schedule"
        description={COURSE_SCHEDULE_SECTION_DESCRIPTION}
      >
        <DataTable
          title="Event Types"
          description={COURSE_SCHEDULE_EVENT_TYPES_DESCRIPTION}
          items={eventTypes}
          isLoading={isLoading}
          minWidthClassName="min-w-[34rem] sm:min-w-[38rem]"
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
                <div className="flex justify-end">
                  <DataTableActionMenu triggerLabel={`Open actions for ${item.code}`}>
                    <DropdownMenuItem onClick={() => setEditingType(item)}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setPendingDeleteType(item)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DataTableActionMenu>
                </div>
              </TableCell>
            </TableRow>
          )}
        />
        <AlertDialog open={pendingDeleteType !== null} onOpenChange={(open) => !open && setPendingDeleteType(null)}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingDeleteType ? `Delete event type ${pendingDeleteType.code}?` : 'Delete event type?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone and may affect sections using this event type.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (!pendingDeleteType) return;
                  void handleDeleteEventType(pendingDeleteType.code);
                  setPendingDeleteType(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsSection>

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
