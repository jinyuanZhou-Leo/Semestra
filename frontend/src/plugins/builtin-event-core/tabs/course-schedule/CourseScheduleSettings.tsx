// input:  [course context, schedule service CRUD APIs, shared SettingsSection, and shared EventTypesDataTable UI]
// output: [`CourseScheduleSettings` settings panel for course-scoped event-type management]
// pos:    [Course-only event-type settings surface that edits builtin-event-core event-type definitions via scheduleService and publishes course schedule refresh events on change]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { toast } from 'sonner';
import { SettingsSection } from '@/components/SettingsSection';
import scheduleService, { type CourseEventType } from '@/services/schedule';
import { publishTimetableScheduleChange } from '../../shared/publishTimetableScheduleChange';
import { EventTypesDataTable, type EventTypeFormData } from './EventTypesDataTable';

interface CourseScheduleSettingsProps {
  courseId: string;
}

const COURSE_SCHEDULE_SECTION_DESCRIPTION = 'Manage the event types available for course schedules, including their labels and attendance tracking.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const response = error.response;
    if (isRecord(response)) {
      const data = response.data;
      if (isRecord(data)) {
        const detail = data.detail;
        if (isRecord(detail) && typeof detail.message === 'string') {
          return detail.message;
        }
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export const CourseScheduleSettings: React.FC<CourseScheduleSettingsProps> = ({ courseId }) => {
  const [eventTypes, setEventTypes] = React.useState<CourseEventType[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const loadRequestIdRef = React.useRef(0);

  const loadEventTypes = React.useCallback(async () => {
    const loadRequestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = loadRequestId;
    setIsLoading(true);
    try {
      const typeData = await scheduleService.getCourseEventTypes(courseId);
      if (loadRequestIdRef.current !== loadRequestId) return;
      setEventTypes(typeData);
    } catch (err: unknown) {
      if (loadRequestIdRef.current !== loadRequestId) return;
      toast.error(extractErrorMessage(err, 'Failed to load event types.'));
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

  const publishScheduleChange = React.useCallback(async (
    reason: 'event-type-created' | 'event-type-updated' | 'event-type-deleted',
  ) => {
    await publishTimetableScheduleChange({ source: 'course', reason, courseId });
  }, [courseId]);

  const handleCreateOrUpdate = React.useCallback(async (
    data: EventTypeFormData,
    editingType: CourseEventType | null,
  ) => {
    try {
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
      await loadEventTypes();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, 'Failed to save event type.'));
      throw err;
    }
  }, [courseId, loadEventTypes, publishScheduleChange]);

  const handleDelete = React.useCallback(async (eventTypeCode: string) => {
    try {
      await scheduleService.deleteCourseEventType(courseId, eventTypeCode);
      await publishScheduleChange('event-type-deleted');
      await loadEventTypes();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, 'Failed to delete event type.'));
    }
  }, [courseId, loadEventTypes, publishScheduleChange]);

  return (
    <SettingsSection
      title="Course Schedule"
      description={COURSE_SCHEDULE_SECTION_DESCRIPTION}
    >
      <EventTypesDataTable
        eventTypes={eventTypes}
        isLoading={isLoading}
        onCreateOrUpdate={handleCreateOrUpdate}
        onDelete={handleDelete}
      />
    </SettingsSection>
  );
};
