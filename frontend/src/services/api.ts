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
}

export interface Course {
    id: string;
    name: string;
    credits: number;
    grade_scaled: number;
    grade_percentage: number;
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

const api = {
    // Programs
    getPrograms: async () => {
        const response = await axios.get<Program[]>('/api/programs/');
        return response.data;
    },
    createProgram: async (data: { name: string; grad_requirement_credits: number }) => {
        const response = await axios.post<Program>('/api/programs/', data);
        return response.data;
    },
    getProgram: async (id: string) => {
        const response = await axios.get<Program & { semesters: Semester[] }>(`/api/programs/${id}`);
        return response.data;
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
        // Requires backend to return widgets in response
        const response = await axios.get<Semester & { courses: Course[], widgets: Widget[], tabs: Tab[] }>(`/api/semesters/${id}`);
        return response.data;
    },
    updateSemester: async (id: string, data: any) => {
        const response = await axios.put<Semester>(`/api/semesters/${id}`, data);
        return response.data;
    },
    deleteSemester: async (id: string) => {
        await axios.delete(`/api/semesters/${id}`);
    },

    // Courses
    createCourse: async (semesterId: string, data: any) => {
        const response = await axios.post<Course>(`/api/semesters/${semesterId}/courses/`, data);
        return response.data;
    },
    getCourse: async (id: string) => {
        const response = await axios.get<Course & { widgets?: Widget[]; tabs?: Tab[] }>(`/api/courses/${id}`);
        return response.data;
    },
    updateCourse: async (id: string, data: any) => {
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
        const response = await axios.put<{ id: string, email: string, gpa_scaling_table?: string }>('/api/users/me', data);
        return response.data;
    }
};

export default api;
