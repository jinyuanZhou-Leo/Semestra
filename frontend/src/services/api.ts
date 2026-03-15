// input:  [axios client, `/api/*` backend endpoints, request payloads from pages/hooks, LMS validation forms, and widget delete options]
// output: [Program/Semester/Course/Widget/Tab/PluginSetting/Todo/Gradebook/LMS contract types and default `api` CRUD service]
// pos:    [Main REST gateway used by dashboards, framework-managed settings sync, auth-adjacent data flows, global user-preference persistence, multi-integration LMS management, Program/Course LMS linking, Program subject-color persistence, account-wide course-resource file and saved-link APIs, persisted todo APIs without backend todo reordering, fact-oriented course gradebook APIs, and one-time LMS gradebook imports]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import axios from 'axios';

// Interfaces matches Pydantic schemas
export interface Program {
    id: string;
    name: string;
    cgpa_scaled: number;
    cgpa_percentage: number;
    grad_requirement_credits: number;
    gpa_scaling_table?: string;
    subject_color_map?: string;
    hide_gpa?: boolean;
    lms_integration_id?: string | null;
    has_lms_dependencies?: boolean;
    lms_integration?: LmsIntegrationSummary | null;
}

export interface Semester {
    id: string;
    name: string;
    average_scaled: number;
    average_percentage: number;
    start_date?: string;
    end_date?: string;
    reading_week_start?: string | null;
    reading_week_end?: string | null;
    program_id?: string;
    courses?: Course[];
}

export interface Course {
    id: string;
    name: string;
    alias?: string;
    category?: string;
    color?: string | null;
    credits: number;
    grade_scaled: number;
    grade_percentage: number;
    program_id: string;
    semester_id?: string;
    include_in_gpa?: boolean;
    hide_gpa?: boolean;
    has_gradebook?: boolean;
    gradebook_revision?: number;
    has_lms_link?: boolean;
    lms_link?: LmsCourseLinkSummary | null;
    widgets?: Widget[];
    tabs?: Tab[];
}

export interface Widget {
    id: string;
    widget_type: string;
    title: string;
    layout_config: string;
    settings: string;
    is_removable?: boolean;
}

export interface Tab {
    id: string;
    tab_type: string;
    title: string;
    settings: string;
    order_index: number;
    is_removable?: boolean;
    is_draggable?: boolean;
}

export interface PluginSetting {
    id: string;
    plugin_id: string;
    settings: string;
    semester_id?: string;
    course_id?: string;
}

export interface CourseResourceFile {
    id: string;
    course_id: string;
    filename_original: string;
    filename_display: string;
    resource_kind: string;
    external_url?: string | null;
    mime_type: string;
    size_bytes: number;
    storage_path: string;
    created_at: string;
    updated_at: string;
}

export interface CourseResourceUploadFailure {
    filename: string;
    code: string;
    message: string;
}

export interface CourseResourceListResponse {
    files: CourseResourceFile[];
    total_bytes_used: number;
    total_bytes_limit: number;
    remaining_bytes: number;
}

export interface CourseResourceUploadResponse {
    uploaded_files: CourseResourceFile[];
    failed_files: CourseResourceUploadFailure[];
    total_bytes_used: number;
    total_bytes_limit: number;
    remaining_bytes: number;
}

export interface User {
    id: string;
    email: string;
    nickname?: string;
    user_setting?: string | null;
    gpa_scaling_table?: string;
    default_course_credit?: number;
    background_plugin_preload?: boolean;
    google_sub?: string | null;
}

export interface LmsIntegrationError {
    code: string;
    message: string;
}

export interface LmsConnectionSummary {
    external_user_id: string;
    display_name?: string | null;
    login_id?: string | null;
    email?: string | null;
}

export interface LmsIntegrationSummary {
    id: string;
    display_name: string;
    provider: string;
}

export interface LmsIntegrationValidationResponse {
    provider: string;
    status: string;
    last_checked_at?: string | null;
    last_error?: LmsIntegrationError | null;
    summary?: LmsConnectionSummary | null;
}

export interface LmsIntegrationResponse {
    id: string;
    display_name: string;
    provider: string;
    status: string;
    config: Record<string, unknown>;
    masked_api_key?: string | null;
    last_checked_at?: string | null;
    last_error?: LmsIntegrationError | null;
    summary?: LmsConnectionSummary | null;
}

export interface LmsCourseSummary {
    external_id: string;
    name: string;
    course_code?: string | null;
    workflow_state?: string | null;
    start_at?: string | null;
    end_at?: string | null;
}

export interface LmsCourseListResponse {
    integration_id: string;
    items: LmsCourseSummary[];
    page: number;
    page_size: number;
    has_more: boolean;
    next_page?: number | null;
}

export interface LmsCourseLinkSummary {
    id: string;
    lms_integration_id: string;
    integration_display_name: string;
    provider: string;
    external_course_id: string;
    external_course_code?: string | null;
    external_name?: string | null;
    sync_enabled: boolean;
    last_synced_at?: string | null;
    last_error?: LmsIntegrationError | null;
}

export interface LmsCourseImportResult {
    external_course_id: string;
    status: 'created' | 'skipped' | 'conflict';
    course?: Course | null;
    error?: LmsIntegrationError | null;
}

export interface LmsCourseImportResponse {
    integration_id: string;
    results: LmsCourseImportResult[];
}

export interface LmsAssignmentSummary {
    external_id: string;
    course_id: string;
    course_name: string;
    course_display_code: string;
    title: string;
    description?: string | null;
    due_at?: string | null;
    due_date?: string | null;
    unlock_at?: string | null;
    lock_at?: string | null;
    html_url?: string | null;
    published: boolean;
    submission_types: string[];
}

export interface LmsAssignmentListResponse {
    items: LmsAssignmentSummary[];
}

export interface LmsCalendarEventSummary {
    external_id: string;
    source_id: string;
    course_id: string;
    course_name: string;
    course_display_code: string;
    title: string;
    description?: string | null;
    location?: string | null;
    start_at: string;
    end_at: string;
    all_day: boolean;
    html_url?: string | null;
    event_type_code: string;
}

export interface LmsCalendarEventListResponse {
    items: LmsCalendarEventSummary[];
}

export interface LmsSemesterImportResponse {
    semester: Semester;
    courses: LmsCourseImportResponse;
}

export type TodoPriority = '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TodoSectionRecord {
    id: string;
    semester_id: string;
    name: string;
    created_at: string;
    updated_at: string;
}

export interface TodoTaskRecord {
    id: string;
    semester_id: string;
    title: string;
    note: string;
    due_date: string | null;
    due_time: string | null;
    priority: TodoPriority;
    completed: boolean;
    course_id: string | null;
    course_name: string;
    course_category: string;
    course_color: string | null;
    section_id: string | null;
    origin_section_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface TodoCourseOptionRecord {
    id: string;
    name: string;
    category: string;
    color: string | null;
}

export interface TodoSemesterStateRecord {
    semester_id: string;
    sections: TodoSectionRecord[];
    tasks: TodoTaskRecord[];
    course_options: TodoCourseOptionRecord[];
}

export type GradebookForecastModel = 'auto' | 'simple_minimum_needed';
export type GradebookScalingTable = Record<string, number>;

export interface GradebookAssessmentCategory {
    id: string;
    name: string;
    key: string;
    is_builtin: boolean;
    color_token: string;
    order_index: number;
    is_archived: boolean;
}

export interface GradebookAssessment {
    id: string;
    category_id: string | null;
    title: string;
    due_date: string | null;
    weight: number;
    score: number | null;
    order_index: number;
}

export interface CourseGradebook {
    course_id: string;
    target_gpa: number;
    forecast_model: GradebookForecastModel;
    scaling_table: GradebookScalingTable;
    categories: GradebookAssessmentCategory[];
    assessments: GradebookAssessment[];
}

const inFlightRequests = new Map<string, Promise<unknown>>();

const dedupeGet = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
    const existing = inFlightRequests.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const request = fetcher()
        .finally(() => {
            if (inFlightRequests.get(key) === request) {
                inFlightRequests.delete(key);
            }
        });
    inFlightRequests.set(key, request);
    return request;
};

const stableStringify = (value?: Record<string, unknown>) => {
    if (!value) return '';
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '';
    return entries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
};

const api = {
    // Programs
    getPrograms: async () => {
        return dedupeGet('GET:/api/programs/', async () => {
            const response = await axios.get<Program[]>('/api/programs/');
            return response.data;
        });
    },
    createProgram: async (data: { name: string; grad_requirement_credits: number; program_timezone?: string }) => {
        const response = await axios.post<Program>('/api/programs/', data);
        return response.data;
    },
    getProgram: async (id: string) => {
        return dedupeGet(`GET:/api/programs/${id}`, async () => {
            const response = await axios.get<Program & { semesters: Semester[] }>(`/api/programs/${id}`);
            return response.data;
        });
    },
    updateProgram: async (id: string, data: any) => {
        const response = await axios.put<Program>(`/api/programs/${id}`, data);
        return response.data;
    },
    deleteProgram: async (id: string) => {
        await axios.delete(`/api/programs/${id}`);
    },

    // Semesters
    createSemester: async (programId: string, data: { name: string }) => {
        const response = await axios.post<Semester>(`/api/programs/${programId}/semesters/`, data);
        return response.data;
    },
    uploadSemesterICS: async (programId: string, file: File, name?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (name) {
            formData.append('name', name);
        }
        const response = await axios.post<Semester>(`/api/programs/${programId}/semesters/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
    getSemester: async (id: string) => {
        return dedupeGet(`GET:/api/semesters/${id}`, async () => {
            // Requires backend to return widgets in response
            const response = await axios.get<Semester & { courses: Course[], widgets: Widget[], tabs: Tab[] }>(`/api/semesters/${id}`);
            return response.data;
        });
    },
    updateSemester: async (id: string, data: any) => {
        const response = await axios.put<Semester>(`/api/semesters/${id}`, data);
        return response.data;
    },
    deleteSemester: async (id: string) => {
        await axios.delete(`/api/semesters/${id}`);
    },
    getSemesterTodo: async (semesterId: string) => {
        return dedupeGet(`GET:/api/semesters/${semesterId}/todo`, async () => {
            const response = await axios.get<TodoSemesterStateRecord>(`/api/semesters/${semesterId}/todo`);
            return response.data;
        });
    },
    createSemesterTodoSection: async (semesterId: string, data: { name: string }) => {
        const response = await axios.post<TodoSemesterStateRecord>(`/api/semesters/${semesterId}/todo/sections`, data);
        return response.data;
    },
    updateSemesterTodoSection: async (semesterId: string, sectionId: string, data: { name?: string }) => {
        const response = await axios.patch<TodoSemesterStateRecord>(`/api/semesters/${semesterId}/todo/sections/${sectionId}`, data);
        return response.data;
    },
    deleteSemesterTodoSection: async (semesterId: string, sectionId: string) => {
        const response = await axios.delete<TodoSemesterStateRecord>(`/api/semesters/${semesterId}/todo/sections/${sectionId}`);
        return response.data;
    },
    createSemesterTodoTask: async (
        semesterId: string,
        data: {
            title: string;
            note?: string;
            due_date?: string | null;
            due_time?: string | null;
            priority?: TodoPriority;
            completed?: boolean;
            course_id?: string | null;
            section_id?: string | null;
            origin_section_id?: string | null;
        },
    ) => {
        const response = await axios.post<TodoSemesterStateRecord>(`/api/semesters/${semesterId}/todo/tasks`, data);
        return response.data;
    },
    updateSemesterTodoTask: async (
        semesterId: string,
        taskId: string,
        data: {
            title?: string;
            note?: string;
            due_date?: string | null;
            due_time?: string | null;
            priority?: TodoPriority;
            completed?: boolean;
            course_id?: string | null;
            section_id?: string | null;
            origin_section_id?: string | null;
        },
    ) => {
        const response = await axios.patch<TodoSemesterStateRecord>(`/api/semesters/${semesterId}/todo/tasks/${taskId}`, data);
        return response.data;
    },
    deleteSemesterTodoTask: async (semesterId: string, taskId: string) => {
        const response = await axios.delete<TodoSemesterStateRecord>(`/api/semesters/${semesterId}/todo/tasks/${taskId}`);
        return response.data;
    },
    clearCompletedSemesterTodoTasks: async (semesterId: string) => {
        const response = await axios.delete<TodoSemesterStateRecord>(`/api/semesters/${semesterId}/todo/tasks/completed`);
        return response.data;
    },
    // Courses
    createCourseForProgram: async (programId: string, data: any) => {
        const response = await axios.post<Course>(`/api/programs/${programId}/courses/`, data);
        return response.data;
    },
    getCoursesForProgram: async (programId: string, params?: { semester_id?: string, unassigned?: boolean }) => {
        const key = `GET:/api/programs/${programId}/courses/?${stableStringify(params)}`;
        return dedupeGet(key, async () => {
            const response = await axios.get<Course[]>(`/api/programs/${programId}/courses/`, { params });
            return response.data;
        });
    },
    createCourse: async (semesterId: string, data: any) => {
        const response = await axios.post<Course>(`/api/semesters/${semesterId}/courses/`, data);
        return response.data;
    },
    getCourse: async (id: string) => {
        return dedupeGet(`GET:/api/courses/${id}`, async () => {
            const response = await axios.get<Course & { widgets?: Widget[]; tabs?: Tab[] }>(`/api/courses/${id}`);
            return response.data;
        });
    },
    updateCourse: async (id: string, data: Partial<Course>) => {
        const response = await axios.put<Course>(`/api/courses/${id}`, data);
        return response.data;
    },
    deleteCourse: async (id: string) => {
        await axios.delete(`/api/courses/${id}`);
    },
    getCourseResources: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/resources`, async () => {
            const response = await axios.get<CourseResourceListResponse>(`/api/courses/${courseId}/resources`);
            return response.data;
        });
    },
    uploadCourseResources: async (courseId: string, files: File[]) => {
        const formData = new FormData();
        files.forEach((file) => {
            formData.append('files', file);
        });
        const response = await axios.post<CourseResourceUploadResponse>(
            `/api/courses/${courseId}/resources/upload`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data;
    },
    renameCourseResource: async (courseId: string, resourceId: string, data: { filename_display: string }) => {
        const response = await axios.patch<CourseResourceFile>(`/api/courses/${courseId}/resources/${resourceId}`, data);
        return response.data;
    },
    createCourseResourceLink: async (courseId: string, data: { url: string; filename_display?: string }) => {
        const response = await axios.post<CourseResourceFile>(`/api/courses/${courseId}/resources/links`, data);
        return response.data;
    },
    deleteCourseResource: async (courseId: string, resourceId: string) => {
        await axios.delete(`/api/courses/${courseId}/resources/${resourceId}`);
    },
    buildCourseResourceOpenUrl: (courseId: string, resourceId: string, options?: { download?: boolean }) => (
        `/api/courses/${courseId}/resources/${resourceId}/download${options?.download ? '?download=true' : ''}`
    ),

    // Widgets
    createWidget: async (semesterId: string, data: { widget_type: string; title: string }) => {
        const response = await axios.post<Widget>(`/api/semesters/${semesterId}/widgets/`, data);
        return response.data;
    },
    createWidgetForCourse: async (courseId: string, data: { widget_type: string; title: string }) => {
        const response = await axios.post<Widget>(`/api/courses/${courseId}/widgets/`, data);
        return response.data;
    },
    updateWidget: async (widgetId: string, data: any) => {
        const response = await axios.put<Widget>(`/api/widgets/${widgetId}`, data);
        return response.data;
    },
    deleteWidget: async (widgetId: string, options?: { force?: boolean }) => {
        await axios.delete(`/api/widgets/${widgetId}`, {
            params: options?.force ? { force: true } : undefined,
        });
    },

    // Tabs
    createTab: async (semesterId: string, data: { tab_type: string; title: string; settings?: string; order_index?: number; is_removable?: boolean; is_draggable?: boolean }) => {
        const response = await axios.post<Tab>(`/api/semesters/${semesterId}/tabs/`, data);
        return response.data;
    },
    createTabForCourse: async (courseId: string, data: { tab_type: string; title: string; settings?: string; order_index?: number; is_removable?: boolean; is_draggable?: boolean }) => {
        const response = await axios.post<Tab>(`/api/courses/${courseId}/tabs/`, data);
        return response.data;
    },
    updateTab: async (tabId: string, data: any) => {
        const response = await axios.put<Tab>(`/api/tabs/${tabId}`, data);
        return response.data;
    },
    deleteTab: async (tabId: string) => {
        await axios.delete(`/api/tabs/${tabId}`);
    },

    // Plugin settings
    getPluginSettingsForSemester: async (semesterId: string) => {
        return dedupeGet(`GET:/api/semesters/${semesterId}/plugin-settings`, async () => {
            const response = await axios.get<PluginSetting[]>(`/api/semesters/${semesterId}/plugin-settings`);
            return response.data;
        });
    },
    getPluginSettingsForCourse: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/plugin-settings`, async () => {
            const response = await axios.get<PluginSetting[]>(`/api/courses/${courseId}/plugin-settings`);
            return response.data;
        });
    },
    upsertPluginSettingsForSemester: async (semesterId: string, pluginId: string, data: { settings: string }) => {
        const response = await axios.put<PluginSetting>(`/api/semesters/${semesterId}/plugin-settings/${pluginId}`, {
            plugin_id: pluginId,
            settings: data.settings,
        });
        return response.data;
    },
    upsertPluginSettingsForCourse: async (courseId: string, pluginId: string, data: { settings: string }) => {
        const response = await axios.put<PluginSetting>(`/api/courses/${courseId}/plugin-settings/${pluginId}`, {
            plugin_id: pluginId,
            settings: data.settings,
        });
        return response.data;
    },

    // Gradebook
    getCourseGradebook: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/gradebook`, async () => {
            const response = await axios.get<CourseGradebook>(`/api/courses/${courseId}/gradebook`);
            return response.data;
        });
    },
    updateCourseGradebookPreferences: async (
        courseId: string,
        data: { target_gpa?: number; forecast_model?: GradebookForecastModel }
    ) => {
        const response = await axios.patch<CourseGradebook>(`/api/courses/${courseId}/gradebook/preferences`, data);
        return response.data;
    },
    createCourseGradebookCategory: async (
        courseId: string,
        data: { name: string; color_token?: string }
    ) => {
        const response = await axios.post<CourseGradebook>(`/api/courses/${courseId}/gradebook/categories`, data);
        return response.data;
    },
    updateCourseGradebookCategory: async (
        courseId: string,
        categoryId: string,
        data: { name?: string; color_token?: string; is_archived?: boolean }
    ) => {
        const response = await axios.patch<CourseGradebook>(`/api/courses/${courseId}/gradebook/categories/${categoryId}`, data);
        return response.data;
    },
    deleteCourseGradebookCategory: async (
        courseId: string,
        categoryId: string,
        data?: Record<string, never>
    ) => {
        const response = await axios.delete<CourseGradebook>(`/api/courses/${courseId}/gradebook/categories/${categoryId}`, { data });
        return response.data;
    },
    createCourseGradebookAssessment: async (
        courseId: string,
        data: {
            category_id?: string | null;
            title: string;
            due_date?: string | null;
            weight: number;
            score?: number | null;
        }
    ) => {
        const response = await axios.post<CourseGradebook>(`/api/courses/${courseId}/gradebook/assessments`, data);
        return response.data;
    },
    updateCourseGradebookAssessment: async (
        courseId: string,
        assessmentId: string,
        data: {
            category_id?: string | null;
            title?: string;
            due_date?: string | null;
            weight?: number;
            score?: number | null;
        }
    ) => {
        const response = await axios.patch<CourseGradebook>(`/api/courses/${courseId}/gradebook/assessments/${assessmentId}`, data);
        return response.data;
    },
    deleteCourseGradebookAssessment: async (
        courseId: string,
        assessmentId: string,
        data?: Record<string, never>
    ) => {
        const response = await axios.delete<CourseGradebook>(`/api/courses/${courseId}/gradebook/assessments/${assessmentId}`, { data });
        return response.data;
    },
    reorderCourseGradebookAssessments: async (
        courseId: string,
        data: { assessment_ids: string[] }
    ) => {
        const response = await axios.put<CourseGradebook>(`/api/courses/${courseId}/gradebook/assessments/reorder`, data);
        return response.data;
    },
    // Auth
    updateUser: async (data: any) => {
        const response = await axios.put<User>('/api/users/me', data);
        return response.data;
    },
    listLmsIntegrations: async () => {
        return dedupeGet('GET:/api/users/me/lms-integrations', async () => {
            const response = await axios.get<LmsIntegrationResponse[]>('/api/users/me/lms-integrations');
            return response.data;
        });
    },
    getLmsIntegration: async (integrationId: string) => {
        return dedupeGet(`GET:/api/users/me/lms-integrations/${integrationId}`, async () => {
            const response = await axios.get<LmsIntegrationResponse>(`/api/users/me/lms-integrations/${integrationId}`);
            return response.data;
        });
    },
    createLmsIntegration: async (data: {
        provider: string;
        display_name: string;
        config: Record<string, unknown>;
        credentials: Record<string, unknown>;
    }) => {
        const response = await axios.post<LmsIntegrationResponse>('/api/users/me/lms-integrations', data);
        return response.data;
    },
    updateLmsIntegration: async (
        integrationId: string,
        data: {
            display_name?: string;
            config?: Record<string, unknown>;
            credentials?: Record<string, unknown>;
        }
    ) => {
        const response = await axios.patch<LmsIntegrationResponse>(`/api/users/me/lms-integrations/${integrationId}`, data);
        return response.data;
    },
    validateLmsIntegrationDraft: async (data: {
        provider: string;
        config: Record<string, unknown>;
        credentials: Record<string, unknown>;
    }) => {
        const response = await axios.post<LmsIntegrationValidationResponse>('/api/users/me/lms-integrations/validate', data);
        return response.data;
    },
    validateSavedLmsIntegration: async (integrationId: string) => {
        const response = await axios.post<LmsIntegrationValidationResponse>(`/api/users/me/lms-integrations/${integrationId}/validate`);
        return response.data;
    },
    deleteLmsIntegration: async (integrationId: string) => {
        await axios.delete(`/api/users/me/lms-integrations/${integrationId}`);
    },
    listProgramLmsCourses: async (
        programId: string,
        params?: { page?: number; page_size?: number; workflow_state?: string; enrollment_state?: string }
    ) => {
        const key = `GET:/api/programs/${programId}/lms/courses?${stableStringify(params)}`;
        return dedupeGet(key, async () => {
            const response = await axios.get<LmsCourseListResponse>(`/api/programs/${programId}/lms/courses`, { params });
            return response.data;
        });
    },
    importProgramLmsCourses: async (
        programId: string,
        data: {
            external_course_ids: string[];
            semester_id?: string;
        }
    ) => {
        const response = await axios.post<LmsCourseImportResponse>(`/api/programs/${programId}/lms/courses/import`, data);
        return response.data;
    },
    importProgramLmsSemester: async (
        programId: string,
        data: {
            name: string;
            start_date?: string;
            end_date?: string;
            reading_week_start?: string | null;
            reading_week_end?: string | null;
            external_course_ids: string[];
        }
    ) => {
        const response = await axios.post<LmsSemesterImportResponse>(`/api/programs/${programId}/lms/semesters/import`, data);
        return response.data;
    },
    getCourseLmsLink: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms-link`, async () => {
            const response = await axios.get<LmsCourseLinkSummary | null>(`/api/courses/${courseId}/lms-link`);
            return response.data;
        });
    },
    upsertCourseLmsLink: async (
        courseId: string,
        data: {
            external_course_id: string;
            sync_enabled?: boolean;
        }
    ) => {
        const response = await axios.put<LmsCourseLinkSummary>(`/api/courses/${courseId}/lms-link`, data);
        return response.data;
    },
    syncCourseLmsLink: async (
        courseId: string,
        data?: {
            sync_enabled?: boolean;
        }
    ) => {
        const response = await axios.post<LmsCourseLinkSummary>(`/api/courses/${courseId}/lms-link/sync`, data ?? {});
        return response.data;
    },
    deleteCourseLmsLink: async (courseId: string) => {
        await axios.delete(`/api/courses/${courseId}/lms-link`);
    },
    getCourseLmsAssignments: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/assignments`, async () => {
            const response = await axios.get<LmsAssignmentListResponse>(`/api/courses/${courseId}/lms/assignments`);
            return response.data;
        });
    },
    getSemesterLmsAssignments: async (semesterId: string) => {
        return dedupeGet(`GET:/api/semesters/${semesterId}/lms/assignments`, async () => {
            const response = await axios.get<LmsAssignmentListResponse>(`/api/semesters/${semesterId}/lms/assignments`);
            return response.data;
        });
    },
    getSemesterLmsCalendarEvents: async (semesterId: string) => {
        return dedupeGet(`GET:/api/semesters/${semesterId}/lms/calendar-events`, async () => {
            const response = await axios.get<LmsCalendarEventListResponse>(`/api/semesters/${semesterId}/lms/calendar-events`);
            return response.data;
        });
    },

    // Data Export/Import
    exportUserData: async () => {
        return dedupeGet('GET:/api/users/me/export', async () => {
            const response = await axios.get('/api/users/me/export');
            return response.data;
        });
    },
    importUserData: async (data: any, conflictMode: 'skip' | 'overwrite' | 'rename' = 'skip', includeSettings: boolean = true) => {
        const response = await axios.post(`/api/users/me/import?conflict_mode=${conflictMode}&include_settings=${includeSettings}`, data);
        return response.data;
    }
};

export default api;
