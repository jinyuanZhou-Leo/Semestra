// input:  [axios client, `/api/*` backend endpoints, request payloads from pages/hooks, LMS validation forms, widget delete options, course Canvas navigation/module summary with inline item/page/quiz/grade/syllabus browser requests, Program->Semester->unassigned-Course runtime plugin payloads, and Program/Semester/Course plugin management + plugin-system + Semester draft-wizard routes]
// output: [Program/Semester/Course/Widget/Tab/TabSetting/Todo/Gradebook/LMS contract types, Program/Semester/unassigned-Course plugin management plus plugin-system/draft-wizard review wire models with typed Semester draft steps, runtime availability wire models, and default `api` CRUD service]
// pos:    [Main REST gateway used by dashboards, Program plugin lifecycle management, V2 Program/Semester/Course tab-settings and runtime-tab persistence, Semester and unassigned-Course plugin enablement APIs, explicit plugin-system setup flows, typed Semester draft creation/review flows, auth-adjacent data flows, global user-preference persistence, multi-integration LMS management, Program/Course LMS linking, account-wide course-resource file and saved-link APIs, Canvas navigation/module-summary-with-inline-items/module-item/page/quiz/grade/syllabus browser reads, persisted todo APIs without backend todo reordering, fact-oriented course gradebook APIs with optional point-based score inputs, range-filtered LMS calendar reads, one-time LMS gradebook imports, and runtime plugin availability driven tab resolution]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import axios from 'axios';

export type SemesterDraftStep = 'basics' | 'courses' | 'plugins' | 'plugin-setup' | 'review';

export interface RuntimeAvailability {
    state: 'available' | 'unavailable';
    reason_code?: string | null;
    reason_message?: string | null;
}

export interface TabSetting {
    id: string;
    tab_type: string;
    settings: string;
    resolved_settings?: Record<string, unknown>;
    program_id?: string;
    semester_id?: string;
    course_id?: string;
}

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
    plugin_installations?: ProgramPluginInstallation[];
    tab_settings?: TabSetting[];
}

interface RuntimeResolvedTabWire {
    id?: string;
    type?: string | null;
    tab_type?: string | null;
    title?: string;
    settings?: string | Record<string, unknown> | null;
    resolved_settings?: string | Record<string, unknown> | null;
    order_index?: number;
    is_removable?: boolean;
    is_draggable?: boolean;
    plugin_id?: string;
    availability?: RuntimeAvailability;
}

interface RuntimeResolvedPluginWire {
    id?: string;
    plugin_id?: string;
    available_tab_types?: string[];
    available_widget_types?: string[];
    settings?: string | Record<string, unknown> | null;
    resolved_settings?: string | Record<string, unknown> | null;
}

export interface RuntimeResolvedTab {
    id: string;
    type: string;
    title: string;
    settings: Record<string, unknown>;
    order_index: number;
    is_removable?: boolean;
    is_draggable?: boolean;
    plugin_id?: string;
    availability: RuntimeAvailability;
}

export interface RuntimeResolvedPlugin {
    plugin_id?: string;
    available_tab_types: string[];
    available_widget_types: string[];
    settings: Record<string, unknown>;
    resolved_settings: Record<string, unknown>;
}

export interface RuntimeWorkspacePayload {
    runtime_tabs: RuntimeResolvedTab[];
    tab_catalog_items: RuntimeTabCatalogItem[];
    widget_catalog_items: RuntimeWidgetCatalogItem[];
    enabled_plugin_ids: string[];
    enabled_plugins: RuntimeResolvedPlugin[];
    available_widget_types: string[];
}

interface RuntimeWorkspaceWirePayload {
    runtime_tabs?: RuntimeResolvedTabWire[];
    resolved_tabs?: RuntimeResolvedTabWire[];
    tab_catalog_items?: RuntimeTabCatalogItem[];
    widget_catalog_items?: RuntimeWidgetCatalogItem[];
    enabled_plugin_ids?: string[];
    enabled_plugins?: RuntimeResolvedPluginWire[];
    runtime_plugins?: RuntimeResolvedPluginWire[];
    available_widget_types?: string[];
}

export interface RuntimeTabCatalogItem {
    plugin_id?: string | null;
    tab_type: string;
    title?: string;
    selected?: boolean;
    availability: RuntimeAvailability;
}

export interface RuntimeWidgetCatalogItem {
    plugin_id?: string | null;
    widget_type: string;
    availability: RuntimeAvailability;
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
    lifecycle_state?: 'draft' | 'active' | 'abandoned' | string;
    creation_step?: SemesterDraftStep;
    draft_updated_at?: string | null;
    review_ready?: boolean;
    review_errors?: SemesterDraftReviewIssue[];
    courses?: Course[];
    plugin_activations?: SemesterPluginActivation[];
    tab_settings?: TabSetting[];
    runtime: RuntimeWorkspacePayload;
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
    plugin_activations?: CoursePluginActivation[];
    tab_settings?: TabSetting[];
    runtime: RuntimeWorkspacePayload;
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

export interface ProgramPluginField {
    path: string;
    label?: string | null;
    type?: string | null;
    scope: 'program-only' | 'semester-override' | string;
    default?: unknown;
    description?: string;
    options?: Array<{ label: string; value: string }>;
}

export interface ProgramPluginSetupField {
    path: string;
    label: string;
    type: string;
    persist: 'setupState' | 'semesterOverride' | 'both' | string;
    required?: boolean;
    default_value?: unknown;
    description?: string;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
    summary_labels?: Record<string, string>;
}

export interface ProgramPluginSetupSection {
    id: string;
    title: string;
    description?: string;
    fields: ProgramPluginSetupField[];
}

export interface ProgramPluginInstallation {
    id?: string | null;
    plugin_id: string;
    display_name: string;
    description: string;
    long_description?: string;
    author: string;
    default_version: string;
    locked: boolean;
    version: string;
    is_enabled: boolean;
    capabilities: {
        contexts?: string[];
        available_tab_types?: string[];
        available_widget_types?: string[];
        has_settings?: boolean;
    };
    setup_sections: ProgramPluginSetupSection[];
    program_settings: Record<string, unknown>;
    resolved_program_settings: Record<string, unknown>;
    fields: ProgramPluginField[];
    available: boolean;
    availability_reason?: string | null;
    availability?: RuntimeAvailability | null;
    installed: boolean;
    auth_state?: string;
    auth_message?: string | null;
}

export interface SemesterPluginActivation {
    id?: string | null;
    semester_id: string;
    program_plugin_installation_id: string;
    plugin_id: string;
    display_name: string;
    description: string;
    long_description?: string;
    author: string;
    locked?: boolean;
    version: string;
    is_enabled: boolean;
    capabilities: ProgramPluginInstallation['capabilities'];
    setup_sections: ProgramPluginSetupSection[];
    semester_overrides: Record<string, unknown>;
    setup_state: Record<string, unknown>;
    resolved_settings: Record<string, unknown>;
    fields: ProgramPluginField[];
    setup_summary?: SemesterDraftReviewSummarySection[];
    review_errors?: SemesterDraftReviewIssue[];
    available: boolean;
    availability_reason?: string | null;
    availability?: RuntimeAvailability | null;
    auth_state?: string;
}

export interface CoursePluginActivation {
    id?: string | null;
    course_id: string;
    program_plugin_installation_id: string;
    plugin_id: string;
    display_name: string;
    description: string;
    long_description?: string;
    author: string;
    locked?: boolean;
    version: string;
    is_enabled: boolean;
    auth_state?: string;
    capabilities: ProgramPluginInstallation['capabilities'];
    resolved_settings?: Record<string, unknown>;
    available: boolean;
    availability_reason?: string | null;
    availability?: RuntimeAvailability | null;
    source: 'course' | 'semester';
}

export interface PluginSystemSetupDefinitionResponse {
    plugin_id: string;
    sections: ProgramPluginSetupSection[];
}

export interface PluginSystemSemesterSetupPlugin {
    plugin_id: string;
    display_name: string;
    description: string;
    long_description?: string;
    author: string;
    is_enabled: boolean;
    available: boolean;
    availability_reason?: string | null;
    setup_sections: ProgramPluginSetupSection[];
    setup_values: Record<string, unknown>;
    setup_summary: SemesterDraftReviewSummarySection[];
    review_errors: SemesterDraftReviewIssue[];
}

export interface PluginSystemSemesterSetupResponse {
    semester_id: string;
    step: string;
    plugins: PluginSystemSemesterSetupPlugin[];
}

export interface PluginSystemSemesterSetupUpdateResponse {
    semester_id: string;
    plugin_id: string;
    setup_values: Record<string, unknown>;
    setup_summary: SemesterDraftReviewSummarySection[];
    review_errors: SemesterDraftReviewIssue[];
}

export interface PluginSystemReviewPlugin {
    plugin_id: string;
    review_errors: SemesterDraftReviewIssue[];
    setup_summary: SemesterDraftReviewSummarySection[];
}

export interface PluginSystemReviewResponse {
    semester_id: string;
    plugins: PluginSystemReviewPlugin[];
    has_errors: boolean;
}

export interface SemesterDraftReviewIssue {
    code: string;
    message: string;
    step: string;
    plugin_id?: string | null;
    field_path?: string | null;
}

export interface SemesterDraftReviewSummaryItem {
    path: string;
    label: string;
    value: string;
}

export interface SemesterDraftReviewSummarySection {
    id: string;
    title: string;
    description?: string;
    items: SemesterDraftReviewSummaryItem[];
}

export interface SemesterDraft extends Semester {
    plugin_activations: SemesterPluginActivation[];
    review_errors: SemesterDraftReviewIssue[];
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

export interface LmsCoursePageSummary {
    page_id: string | number;
    url: string;
    title: string;
    updated_at?: string | null;
    published: boolean;
    front_page: boolean;
    html_url?: string | null;
}

export interface LmsCoursePageDetail extends LmsCoursePageSummary {
    body?: string | null;
    locked_for_user?: boolean;
    lock_explanation?: string | null;
    editing_roles?: string | null;
}

export interface LmsCoursePageListResponse {
    items: LmsCoursePageSummary[];
}

export interface LmsCourseNavigationTab {
    tab_id: string;
    label: string;
    html_url?: string | null;
    hidden: boolean;
    position: number;
    tab_type?: string | null;
    active: boolean;
}

export interface LmsCourseNavigationResponse {
    default_view?: string | null;
    front_page_url?: string | null;
    tabs: LmsCourseNavigationTab[];
}

export interface LmsAnnouncementSummary {
    announcement_id: string;
    title: string;
    body?: string | null;
    posted_at?: string | null;
    updated_at?: string | null;
    html_url?: string | null;
}

export interface LmsAnnouncementListResponse {
    items: LmsAnnouncementSummary[];
}

export interface LmsModuleItem {
    module_item_id: string;
    title: string;
    item_type?: string | null;
    content_id?: string | null;
    html_url?: string | null;
    url?: string | null;
    position?: number | null;
    indent?: number | null;
    published: boolean;
    completion_requirement_type?: string | null;
    new_tab: boolean;
    target_type?: string | null;
    page_url?: string | null;
    external_url?: string | null;
    content_details?: Record<string, unknown> | null;
    in_app_supported?: boolean;
}

export interface LmsModuleSummary {
    module_id: string;
    name: string;
    position?: number | null;
    published: boolean;
    state?: string | null;
    unlock_at?: string | null;
    item_count: number;
    items: LmsModuleItem[];
}

export interface LmsModuleListResponse {
    items: LmsModuleSummary[];
}

export interface LmsModuleItemListResponse {
    items: LmsModuleItem[];
}

export interface LmsQuizSummary {
    quiz_id: string;
    title: string;
    description?: string | null;
    due_at?: string | null;
    unlock_at?: string | null;
    lock_at?: string | null;
    html_url?: string | null;
    published: boolean;
}

export interface LmsQuizListResponse {
    items: LmsQuizSummary[];
}

export interface LmsCourseSyllabusResponse {
    body?: string | null;
    html_url?: string | null;
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

export interface LmsGradeSummary {
    enrollment_id: string;
    course_id: string;
    course_name: string;
    course_display_code: string;
    enrollment_type?: string | null;
    enrollment_role?: string | null;
    enrollment_state?: string | null;
    html_url?: string | null;
    grades_html_url?: string | null;
    current_grade?: string | null;
    final_grade?: string | null;
    current_score?: number | null;
    final_score?: number | null;
    current_points?: number | null;
    unposted_current_grade?: string | null;
    unposted_final_grade?: string | null;
    unposted_current_score?: number | null;
    unposted_final_score?: number | null;
    has_grading_periods: boolean;
    current_grading_period_title?: string | null;
    current_period_current_grade?: string | null;
    current_period_final_grade?: string | null;
    current_period_current_score?: number | null;
    current_period_final_score?: number | null;
}

export interface LmsGradeListResponse {
    items: LmsGradeSummary[];
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
    points_earned: number | null;
    points_possible: number | null;
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

type CourseWire = Omit<Course, 'runtime' | 'courses'> & RuntimeWorkspaceWirePayload;
type SemesterWire = Omit<Semester, 'runtime' | 'courses'> & RuntimeWorkspaceWirePayload & {
    courses?: CourseWire[];
};
type ProgramWire = Program & {
    semesters?: SemesterWire[];
};

const parseObjectPayload = (value: unknown): Record<string, unknown> => {
    if (!value) {
        return {};
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : {};
        } catch (error) {
            console.warn('Failed to parse runtime payload object', error);
            return {};
        }
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
};

export const normalizeRuntimeResolvedTab = (
    tab?: RuntimeResolvedTabWire | null,
    index = 0,
): RuntimeResolvedTab | null => {
    const type = tab?.type ?? tab?.tab_type ?? '';
    if (!type) {
        return null;
    }

    return {
        id: tab?.id && tab.id.length > 0 ? tab.id : `${type}:${index}`,
        type,
        title: tab?.title && tab.title.length > 0 ? tab.title : type,
        settings: parseObjectPayload(tab?.resolved_settings ?? tab?.settings),
        order_index: typeof tab?.order_index === 'number' ? tab.order_index : index,
        is_removable: tab?.is_removable,
        is_draggable: tab?.is_draggable,
        plugin_id: tab?.plugin_id,
        availability: tab?.availability ?? { state: 'available' },
    };
};

const normalizeRuntimeResolvedPlugin = (
    plugin?: RuntimeResolvedPluginWire | null,
): RuntimeResolvedPlugin => ({
    plugin_id: plugin?.plugin_id ?? plugin?.id,
    available_tab_types: plugin?.available_tab_types ?? [],
    available_widget_types: plugin?.available_widget_types ?? [],
    settings: parseObjectPayload(plugin?.settings),
    resolved_settings: parseObjectPayload(plugin?.resolved_settings ?? plugin?.settings),
});

const normalizeRuntimeWorkspacePayload = (
    entity?: RuntimeWorkspaceWirePayload | null
): RuntimeWorkspacePayload => ({
    runtime_tabs: (entity?.runtime_tabs ?? entity?.resolved_tabs ?? [])
        .map((tab, index) => normalizeRuntimeResolvedTab(tab, index))
        .filter((tab): tab is RuntimeResolvedTab => tab !== null),
    tab_catalog_items: entity?.tab_catalog_items ?? [],
    widget_catalog_items: entity?.widget_catalog_items ?? [],
    enabled_plugin_ids: entity?.enabled_plugin_ids ?? [],
    enabled_plugins: (entity?.enabled_plugins ?? entity?.runtime_plugins ?? []).map(normalizeRuntimeResolvedPlugin),
    available_widget_types: entity?.available_widget_types
        ?? (entity?.enabled_plugins ?? entity?.runtime_plugins ?? []).flatMap((plugin) => plugin.available_widget_types ?? []),
});

const normalizeCourse = (course: CourseWire): Course => ({
    ...course,
    runtime: normalizeRuntimeWorkspacePayload(course),
});

const normalizeSemester = (semester: SemesterWire): Semester & { courses: Course[] } => ({
    ...semester,
    courses: semester.courses?.map(normalizeCourse) ?? [],
    runtime: normalizeRuntimeWorkspacePayload(semester),
});

const normalizeProgram = (program: ProgramWire): Program & { semesters: Semester[] } => ({
    ...program,
    semesters: program.semesters?.map(normalizeSemester) ?? [],
});

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
    getProgram: async (id: string): Promise<Program & { semesters: Semester[] }> => {
        return dedupeGet(`GET:/api/programs/${id}`, async () => {
            const response = await axios.get<ProgramWire>(`/api/programs/${id}`);
            return normalizeProgram(response.data);
        });
    },
    updateProgram: async (id: string, data: any) => {
        const response = await axios.put<Program>(`/api/programs/${id}`, data);
        return response.data;
    },
    deleteProgram: async (id: string) => {
        await axios.delete(`/api/programs/${id}`);
    },
    getProgramPluginCatalog: async (programId: string) => {
        return dedupeGet(`GET:/api/programs/${programId}/plugins/catalog`, async () => {
            const response = await axios.get<ProgramPluginInstallation[]>(`/api/programs/${programId}/plugins/catalog`);
            return response.data;
        });
    },
    getProgramPluginInstallations: async (programId: string) => {
        return dedupeGet(`GET:/api/programs/${programId}/plugins/installations`, async () => {
            const response = await axios.get<ProgramPluginInstallation[]>(`/api/programs/${programId}/plugins/installations`);
            return response.data;
        });
    },
    upsertProgramPluginInstallation: async (
        programId: string,
        pluginId: string,
        data: {
            is_enabled?: boolean;
            version?: string;
            auth_state?: string;
            auth_message?: string | null;
            program_settings?: Record<string, unknown>;
        },
    ) => {
        const response = await axios.put<ProgramPluginInstallation>(`/api/programs/${programId}/plugins/${pluginId}`, data);
        return response.data;
    },
    bulkUpdateProgramPluginInstallations: async (
        programId: string,
        data: {
            plugin_ids: string[];
            is_enabled: boolean;
        },
    ) => {
        const response = await axios.put<ProgramPluginInstallation[]>(`/api/programs/${programId}/plugins:bulk`, data);
        return response.data;
    },
    deleteProgramPluginInstallation: async (programId: string, pluginId: string) => {
        await axios.delete(`/api/programs/${programId}/plugins/${pluginId}`);
    },
    getCurrentSemesterDraft: async (programId: string) => {
        return dedupeGet(`GET:/api/programs/${programId}/semester-draft`, async () => {
            const response = await axios.get<SemesterDraft | null>(`/api/programs/${programId}/semester-draft`);
            return response.data;
        });
    },
    createSemesterDraft: async (
        programId: string,
        data: {
            name?: string;
            start_date?: string;
            end_date?: string;
            reading_week_start?: string | null;
            reading_week_end?: string | null;
            creation_step?: SemesterDraftStep;
        },
    ) => {
        const response = await axios.post<SemesterDraft>(`/api/programs/${programId}/semester-draft`, data);
        return response.data;
    },
    updateSemesterDraft: async (
        semesterId: string,
        data: {
            name?: string;
            start_date?: string;
            end_date?: string;
            reading_week_start?: string | null;
            reading_week_end?: string | null;
            creation_step?: SemesterDraftStep;
        },
    ) => {
        const response = await axios.put<SemesterDraft>(`/api/semesters/${semesterId}/draft`, data);
        return response.data;
    },
    finalizeSemesterDraft: async (semesterId: string) => {
        const response = await axios.post<SemesterDraft>(`/api/semesters/${semesterId}/draft/finalize`);
        return response.data;
    },
    reviewSemesterDraft: async (semesterId: string) => {
        const response = await axios.post<SemesterDraft>(`/api/semesters/${semesterId}/draft/review`);
        return response.data;
    },
    discardSemesterDraft: async (semesterId: string) => {
        await axios.delete(`/api/semesters/${semesterId}/draft`);
    },
    getPluginSystemSetupDefinition: async (pluginId: string) => {
        return dedupeGet(`GET:/api/plugin-system/plugins/${pluginId}/setup-definition`, async () => {
            const response = await axios.get<PluginSystemSetupDefinitionResponse>(`/api/plugin-system/plugins/${pluginId}/setup-definition`);
            return response.data;
        });
    },
    getSemesterPluginSystemSetup: async (semesterId: string) => {
        return dedupeGet(`GET:/api/plugin-system/semesters/${semesterId}/setup`, async () => {
            const response = await axios.get<PluginSystemSemesterSetupResponse>(`/api/plugin-system/semesters/${semesterId}/setup`);
            return response.data;
        });
    },
    updateSemesterPluginSystemSetup: async (
        semesterId: string,
        pluginId: string,
        data: {
            values: Record<string, unknown>;
        },
    ) => {
        const response = await axios.put<PluginSystemSemesterSetupUpdateResponse>(
            `/api/plugin-system/semesters/${semesterId}/plugins/${pluginId}/setup`,
            data,
        );
        return response.data;
    },
    reviewSemesterPluginSystem: async (semesterId: string) => {
        const response = await axios.post<PluginSystemReviewResponse>(`/api/plugin-system/semesters/${semesterId}/review`);
        return response.data;
    },

    // Semesters
    createSemester: async (programId: string, data: { name: string }) => {
        const response = await axios.post<SemesterWire>(`/api/programs/${programId}/semesters/`, data);
        return normalizeSemester(response.data);
    },
    uploadSemesterICS: async (programId: string, file: File, name?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (name) {
            formData.append('name', name);
        }
        const response = await axios.post<SemesterWire>(`/api/programs/${programId}/semesters/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return normalizeSemester(response.data);
    },
    uploadProgramCourseICS: async (programId: string, file: File, semesterId?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (semesterId) {
            formData.append('semester_id', semesterId);
        }
        const response = await axios.post<CourseWire[]>(`/api/programs/${programId}/courses/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.map(normalizeCourse);
    },
    getSemester: async (id: string): Promise<Semester & { courses: Course[]; widgets?: Widget[]; tabs?: Tab[] }> => {
        return dedupeGet(`GET:/api/semesters/${id}`, async () => {
            const response = await axios.get<SemesterWire & { widgets: Widget[], tabs?: Tab[] }>(`/api/semesters/${id}`);
            return normalizeSemester(response.data);
        });
    },
    updateSemester: async (id: string, data: any) => {
        const response = await axios.put<SemesterWire>(`/api/semesters/${id}`, data);
        return normalizeSemester(response.data);
    },
    deleteSemester: async (id: string) => {
        await axios.delete(`/api/semesters/${id}`);
    },
    getSemesterPluginActivations: async (semesterId: string) => {
        return dedupeGet(`GET:/api/semesters/${semesterId}/plugin-activations`, async () => {
            const response = await axios.get<SemesterPluginActivation[]>(`/api/semesters/${semesterId}/plugin-activations`);
            return response.data;
        });
    },
    upsertSemesterPluginActivation: async (
        semesterId: string,
        pluginId: string,
        data: {
            is_enabled?: boolean;
        },
    ) => {
        const response = await axios.put<SemesterPluginActivation>(`/api/semesters/${semesterId}/plugin-activations/${pluginId}`, data);
        return response.data;
    },
    bulkUpdateSemesterPluginActivations: async (
        semesterId: string,
        data: {
            plugin_ids: string[];
            is_enabled: boolean;
        },
    ) => {
        const response = await axios.put<SemesterWire>(`/api/semesters/${semesterId}/plugin-activations:bulk`, data);
        return normalizeSemester(response.data);
    },
    deleteSemesterPluginActivation: async (semesterId: string, pluginId: string) => {
        await axios.delete(`/api/semesters/${semesterId}/plugin-activations/${pluginId}`);
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
        const response = await axios.post<CourseWire>(`/api/programs/${programId}/courses/`, data);
        return normalizeCourse(response.data);
    },
    getCoursesForProgram: async (programId: string, params?: { semester_id?: string, unassigned?: boolean }) => {
        const key = `GET:/api/programs/${programId}/courses/?${stableStringify(params)}`;
        return dedupeGet(key, async () => {
            const response = await axios.get<CourseWire[]>(`/api/programs/${programId}/courses/`, { params });
            return response.data.map(normalizeCourse);
        });
    },
    createCourse: async (semesterId: string, data: any) => {
        const response = await axios.post<CourseWire>(`/api/semesters/${semesterId}/courses/`, data);
        return normalizeCourse(response.data);
    },
    getCourse: async (id: string) => {
        return dedupeGet(`GET:/api/courses/${id}`, async () => {
            const response = await axios.get<CourseWire & { widgets?: Widget[]; tabs?: Tab[]; plugin_activations?: CoursePluginActivation[] }>(`/api/courses/${id}`);
            return normalizeCourse(response.data);
        });
    },
    updateCourse: async (id: string, data: Partial<Omit<Course, 'runtime'>>) => {
        const response = await axios.put<CourseWire>(`/api/courses/${id}`, data);
        return normalizeCourse(response.data);
    },
    deleteCourse: async (id: string) => {
        await axios.delete(`/api/courses/${id}`);
    },
    getCoursePluginActivations: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/plugin-activations`, async () => {
            const response = await axios.get<CoursePluginActivation[]>(`/api/courses/${courseId}/plugin-activations`);
            return response.data;
        });
    },
    upsertCoursePluginActivation: async (
        courseId: string,
        pluginId: string,
        data: {
            is_enabled?: boolean;
        },
    ) => {
        const response = await axios.put<CoursePluginActivation>(`/api/courses/${courseId}/plugin-activations/${pluginId}`, data);
        return response.data;
    },
    bulkUpdateCoursePluginActivations: async (
        courseId: string,
        data: {
            plugin_ids: string[];
            is_enabled: boolean;
        },
    ) => {
        const response = await axios.put<CoursePluginActivation[]>(`/api/courses/${courseId}/plugin-activations:bulk`, data);
        return response.data;
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
    updateSemesterRuntimeTabSettings: async (semesterId: string, tabType: string, data: { settings: string }) => {
        const response = await axios.put<RuntimeResolvedTabWire>(
            `/api/semesters/${semesterId}/runtime-tabs/${encodeURIComponent(tabType)}/settings`,
            data,
        );
        const normalized = normalizeRuntimeResolvedTab(response.data);
        if (!normalized) {
            throw new Error('Semester runtime tab settings response is missing a tab type.');
        }
        return normalized;
    },
    updateCourseRuntimeTabSettings: async (courseId: string, tabType: string, data: { settings: string }) => {
        const response = await axios.put<RuntimeResolvedTabWire>(
            `/api/courses/${courseId}/runtime-tabs/${encodeURIComponent(tabType)}/settings`,
            data,
        );
        const normalized = normalizeRuntimeResolvedTab(response.data);
        if (!normalized) {
            throw new Error('Course runtime tab settings response is missing a tab type.');
        }
        return normalized;
    },
    reorderSemesterRuntimeTabs: async (semesterId: string, tabTypes: string[]) => {
        const response = await axios.put<RuntimeResolvedTabWire[]>(
            `/api/semesters/${semesterId}/runtime-tabs/order`,
            { tab_types: tabTypes },
        );
        return response.data
            .map((tab, index) => normalizeRuntimeResolvedTab(tab, index))
            .filter((tab): tab is RuntimeResolvedTab => tab !== null);
    },
    reorderCourseRuntimeTabs: async (courseId: string, tabTypes: string[]) => {
        const response = await axios.put<RuntimeResolvedTabWire[]>(
            `/api/courses/${courseId}/runtime-tabs/order`,
            { tab_types: tabTypes },
        );
        return response.data
            .map((tab, index) => normalizeRuntimeResolvedTab(tab, index))
            .filter((tab): tab is RuntimeResolvedTab => tab !== null);
    },
    getProgramTabSettings: async (programId: string) => {
        return dedupeGet(`GET:/api/programs/${programId}/tab-settings`, async () => {
            const response = await axios.get<TabSetting[]>(`/api/programs/${programId}/tab-settings`);
            return response.data;
        });
    },
    getSemesterTabSettings: async (semesterId: string) => {
        return dedupeGet(`GET:/api/semesters/${semesterId}/tab-settings`, async () => {
            const response = await axios.get<TabSetting[]>(`/api/semesters/${semesterId}/tab-settings`);
            return response.data;
        });
    },
    getCourseTabSettings: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/tab-settings`, async () => {
            const response = await axios.get<TabSetting[]>(`/api/courses/${courseId}/tab-settings`);
            return response.data;
        });
    },
    upsertProgramTabSettings: async (programId: string, tabType: string, data: { settings: string }) => {
        const response = await axios.put<TabSetting>(`/api/programs/${programId}/tab-settings/${encodeURIComponent(tabType)}`, {
            tab_type: tabType,
            settings: data.settings,
        });
        return response.data;
    },
    upsertSemesterTabSettings: async (semesterId: string, tabType: string, data: { settings: string }) => {
        const response = await axios.put<TabSetting>(`/api/semesters/${semesterId}/tab-settings/${encodeURIComponent(tabType)}`, {
            tab_type: tabType,
            settings: data.settings,
        });
        return response.data;
    },
    upsertCourseTabSettings: async (courseId: string, tabType: string, data: { settings: string }) => {
        const response = await axios.put<TabSetting>(`/api/courses/${courseId}/tab-settings/${encodeURIComponent(tabType)}`, {
            tab_type: tabType,
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
            points_earned?: number | null;
            points_possible?: number | null;
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
            points_earned?: number | null;
            points_possible?: number | null;
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
    getCourseLmsGrades: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/grades`, async () => {
            const response = await axios.get<LmsGradeListResponse>(`/api/courses/${courseId}/lms/grades`);
            return response.data;
        });
    },
    getCourseLmsNavigation: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/navigation`, async () => {
            const response = await axios.get<LmsCourseNavigationResponse>(`/api/courses/${courseId}/lms/navigation`);
            return response.data;
        });
    },
    getCourseLmsAnnouncements: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/announcements`, async () => {
            const response = await axios.get<LmsAnnouncementListResponse>(`/api/courses/${courseId}/lms/announcements`);
            return response.data;
        });
    },
    getCourseLmsModules: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/modules`, async () => {
            const response = await axios.get<LmsModuleListResponse>(`/api/courses/${courseId}/lms/modules`);
            return response.data;
        });
    },
    getCourseLmsModuleItems: async (courseId: string, moduleId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/modules/${moduleId}/items`, async () => {
            const response = await axios.get<LmsModuleItemListResponse>(`/api/courses/${courseId}/lms/modules/${encodeURIComponent(moduleId)}/items`);
            return response.data;
        });
    },
    getCourseLmsQuizzes: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/quizzes`, async () => {
            const response = await axios.get<LmsQuizListResponse>(`/api/courses/${courseId}/lms/quizzes`);
            return response.data;
        });
    },
    getCourseLmsPages: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/pages`, async () => {
            const response = await axios.get<LmsCoursePageListResponse>(`/api/courses/${courseId}/lms/pages`);
            return response.data;
        });
    },
    getCourseLmsPage: async (courseId: string, pageRef: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/pages/${pageRef}`, async () => {
            const response = await axios.get<LmsCoursePageDetail>(`/api/courses/${courseId}/lms/pages/${encodeURIComponent(pageRef)}`);
            return response.data;
        });
    },
    getCourseLmsSyllabus: async (courseId: string) => {
        return dedupeGet(`GET:/api/courses/${courseId}/lms/syllabus`, async () => {
            const response = await axios.get<LmsCourseSyllabusResponse>(`/api/courses/${courseId}/lms/syllabus`);
            return response.data;
        });
    },
    getSemesterLmsAssignments: async (semesterId: string) => {
        return dedupeGet(`GET:/api/semesters/${semesterId}/lms/assignments`, async () => {
            const response = await axios.get<LmsAssignmentListResponse>(`/api/semesters/${semesterId}/lms/assignments`);
            return response.data;
        });
    },
    getSemesterLmsCalendarEvents: async (
        semesterId: string,
        params?: {
            start?: string;
            end?: string;
        }
    ) => {
        return dedupeGet(`GET:/api/semesters/${semesterId}/lms/calendar-events:${JSON.stringify(params ?? {})}`, async () => {
            const response = await axios.get<LmsCalendarEventListResponse>(`/api/semesters/${semesterId}/lms/calendar-events`, { params });
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
