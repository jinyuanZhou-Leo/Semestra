import axios from 'axios';

// Interfaces matches Pydantic schemas
export interface Program {
    id: string;
    name: string;
    cgpa_scaled: number;
    cgpa_percentage: number;
    grad_requirement_credits: number;
    gpa_scaling_table?: string;
    hide_gpa?: boolean;
}

export interface Semester {
    id: string;
    name: string;
    average_scaled: number;
    average_percentage: number;
    program_id?: string;
    courses?: Course[];
}

export interface Course {
    id: string;
    name: string;
    alias?: string;
    category?: string;
    credits: number;
    grade_scaled: number;
    grade_percentage: number;
    program_id: string;
    semester_id?: string;
    include_in_gpa?: boolean;
    hide_gpa?: boolean;
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
    deleteWidget: async (widgetId: string) => {
        await axios.delete(`/api/widgets/${widgetId}`);
    },

    // Tabs
    createTab: async (semesterId: string, data: { tab_type: string; title: string; settings?: string; order_index?: number }) => {
        const response = await axios.post<Tab>(`/api/semesters/${semesterId}/tabs/`, data);
        return response.data;
    },
    createTabForCourse: async (courseId: string, data: { tab_type: string; title: string; settings?: string; order_index?: number }) => {
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

    // Auth
    updateUser: async (data: any) => {
        const response = await axios.put<{ id: string, email: string, gpa_scaling_table?: string, default_course_credit?: number }>('/api/users/me', data);
        return response.data;
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
