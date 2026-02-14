"use no memo";

import React from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import scheduleService, { type CourseEventType } from '@/services/schedule';
import { CrudPanel } from '../../components/CrudPanel';
import { EventTypeFormDialog } from '../../components/EventTypeFormDialog';
import { timetableEventBus } from '../../shared/eventBus';

interface CourseScheduleSettingsProps {
  courseId: string;
}

export const CourseScheduleSettings: React.FC<CourseScheduleSettingsProps> = ({ courseId }) => {
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

  const publishScheduleChange = React.useCallback((
    reason: 'event-type-created' | 'event-type-updated' | 'event-type-deleted',
  ) => {
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
      <SettingsSection>
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label={`Delete event type ${item.code}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete event type {item.code}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone and may affect sections using this event type.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => void handleDeleteEventType(item.code)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          )}
        />
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
