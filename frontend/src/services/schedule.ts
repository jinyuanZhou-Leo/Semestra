import axios from 'axios';

export type WeekPattern = 'EVERY' | 'ODD' | 'EVEN';
export type SkipRenderMode = 'HIDE_SKIPPED' | 'GRAY_SKIPPED';
export type ExportScope = 'course' | 'semester';
export type ExportRange = 'week' | 'weeks' | 'term';

export interface CourseEventType {
  id: string;
  code: string;
  abbreviation: string;
  track_attendance: boolean;
  color?: string | null;
  icon?: string | null;
}

export interface CourseSection {
  id: string;
  sectionId: string;
  eventTypeCode: string;
  title?: string | null;
  instructor?: string | null;
  location?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weekPattern: WeekPattern;
  startWeek: number;
  endWeek: number;
}

export interface CourseEvent {
  id: string;
  eventTypeCode: string;
  sectionId?: string | null;
  title?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weekPattern: WeekPattern;
  startWeek?: number | null;
  endWeek?: number | null;
  enable: boolean;
  skip: boolean;
  note?: string | null;
}

export interface ScheduleItem {
  eventId: string;
  courseId: string;
  courseName: string;
  eventTypeCode: string;
  sectionId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enable: boolean;
  skip: boolean;
  isConflict: boolean;
  conflictGroupId?: string | null;
  week: number;
  title?: string;
  note?: string;
  renderState?: string;
}

export interface ScheduleResponse {
  week: number;
  maxWeek: number;
  items: ScheduleItem[];
  warnings: string[];
}

export interface ExportResponse {
  format: string;
  scope: ExportScope;
  scopeId: string;
  weeks: number[];
  itemCount: number;
  skipRenderMode: SkipRenderMode;
  items: ScheduleItem[];
}

const scheduleService = {
  getCourseEventTypes: async (courseId: string) => {
    const response = await axios.get<CourseEventType[]>(`/api/courses/${courseId}/event-types`);
    return response.data;
  },

  createCourseEventType: async (
    courseId: string,
    payload: {
      code: string;
      abbreviation: string;
      track_attendance?: boolean;
      color?: string;
      icon?: string;
    }
  ) => {
    const response = await axios.post<CourseEventType>(`/api/courses/${courseId}/event-types`, payload);
    return response.data;
  },

  updateCourseEventType: async (
    courseId: string,
    eventTypeCode: string,
    payload: {
      code?: string;
      abbreviation?: string;
      trackAttendance?: boolean;
      color?: string;
      icon?: string;
    }
  ) => {
    const response = await axios.patch<{ event_type: CourseEventType; normalized_events: number }>(
      `/api/courses/${courseId}/event-types/${eventTypeCode}`,
      payload
    );
    return response.data;
  },

  deleteCourseEventType: async (courseId: string, eventTypeCode: string) => {
    await axios.delete(`/api/courses/${courseId}/event-types/${eventTypeCode}`);
  },

  getCourseSections: async (courseId: string) => {
    const response = await axios.get<CourseSection[]>(`/api/courses/${courseId}/sections`);
    return response.data;
  },

  createCourseSection: async (
    courseId: string,
    payload: Omit<CourseSection, 'id'>
  ) => {
    const response = await axios.post<CourseSection>(`/api/courses/${courseId}/sections`, payload);
    return response.data;
  },

  updateCourseSection: async (
    courseId: string,
    sectionId: string,
    payload: Partial<Omit<CourseSection, 'id' | 'sectionId'>>
  ) => {
    const response = await axios.patch<CourseSection>(`/api/courses/${courseId}/sections/${sectionId}`, payload);
    return response.data;
  },

  deleteCourseSection: async (courseId: string, sectionId: string) => {
    await axios.delete(`/api/courses/${courseId}/sections/${sectionId}`);
  },

  importCourseSections: async (
    courseId: string,
    items: Omit<CourseSection, 'id'>[],
    mode: 'merge' | 'replace' = 'merge'
  ) => {
    const response = await axios.post<CourseSection[]>(
      `/api/courses/${courseId}/sections/import?mode=${mode}`,
      { items }
    );
    return response.data;
  },

  getCourseEvents: async (courseId: string) => {
    const response = await axios.get<CourseEvent[]>(`/api/courses/${courseId}/events`);
    return response.data;
  },

  createCourseEvent: async (
    courseId: string,
    payload: Omit<CourseEvent, 'id'>
  ) => {
    const response = await axios.post<CourseEvent>(`/api/courses/${courseId}/events`, payload);
    return response.data;
  },

  updateCourseEvent: async (
    courseId: string,
    eventId: string,
    payload: Partial<Omit<CourseEvent, 'id'>>
  ) => {
    const response = await axios.patch<CourseEvent>(`/api/courses/${courseId}/events/${eventId}`, payload);
    return response.data;
  },

  deleteCourseEvent: async (courseId: string, eventId: string) => {
    await axios.delete(`/api/courses/${courseId}/events/${eventId}`);
  },

  batchCourseEvents: async (
    courseId: string,
    payload: {
      atomic?: boolean;
      items: Array<
        | { op: 'create'; data: Omit<CourseEvent, 'id'> }
        | { op: 'update'; eventId: string; data: Partial<Omit<CourseEvent, 'id'>> }
        | { op: 'delete'; eventId: string }
      >;
    }
  ) => {
    const response = await axios.post(`/api/courses/${courseId}/events/batch`, payload);
    return response.data;
  },

  getCourseSchedule: async (courseId: string, params?: { week?: number; withConflicts?: boolean }) => {
    const response = await axios.get<ScheduleResponse>(`/api/schedule/course/${courseId}`, { params });
    return response.data;
  },

  getSemesterSchedule: async (semesterId: string, params?: { week?: number; withConflicts?: boolean }) => {
    const response = await axios.get<ScheduleResponse>(`/api/schedule/semester/${semesterId}`, { params });
    return response.data;
  },

  exportSchedule: async (
    format: 'png' | 'pdf' | 'ics',
    payload: {
      scope: ExportScope;
      scopeId: string;
      range: ExportRange;
      week?: number;
      startWeek?: number;
      endWeek?: number;
      skipRenderMode?: SkipRenderMode;
    }
  ) => {
    if (format === 'ics') {
      const response = await axios.post(`/api/schedule/export/ics`, payload, { responseType: 'blob' });
      return response.data;
    }
    const response = await axios.post<ExportResponse>(`/api/schedule/export/${format}`, payload);
    return response.data;
  },
};

export default scheduleService;
