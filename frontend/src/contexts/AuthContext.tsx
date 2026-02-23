// input:  [auth token in localStorage, axios `/api/users/me` + 401 interceptor, session modal]
// output: [`AuthProvider` and `useAuth()` exposing user/login/logout/refresh/loading state]
// pos:    [Application-wide authentication context used by route guards and pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { SessionExpiredModal } from '../components/SessionExpiredModal';
import { DEFAULT_GPA_SCALING_TABLE_JSON } from '../utils/gpaUtils';

const DEFAULT_COURSE_CREDIT = 0.5;

interface User {
    id: string;
    email: string;
    nickname?: string;
    user_setting?: string | null;
    gpa_scaling_table?: string;
    default_course_credit?: number;
    google_sub?: string | null;
}

type UserSettings = Pick<User, 'gpa_scaling_table' | 'default_course_credit'>;

const resolveUserSettings = (rawSetting?: string | null): UserSettings => {
    if (!rawSetting) {
        return {
            gpa_scaling_table: DEFAULT_GPA_SCALING_TABLE_JSON,
            default_course_credit: DEFAULT_COURSE_CREDIT
        };
    }

    try {
        const parsed = JSON.parse(rawSetting) as Record<string, unknown>;
        const gpaScalingTable =
            typeof parsed.gpa_scaling_table === 'string' && parsed.gpa_scaling_table
                ? parsed.gpa_scaling_table
                : DEFAULT_GPA_SCALING_TABLE_JSON;
        const defaultCourseCredit =
            typeof parsed.default_course_credit === 'number' && Number.isFinite(parsed.default_course_credit)
                ? parsed.default_course_credit
                : DEFAULT_COURSE_CREDIT;

        return {
            gpa_scaling_table: gpaScalingTable,
            default_course_credit: defaultCourseCredit
        };
    } catch {
        return {
            gpa_scaling_table: DEFAULT_GPA_SCALING_TABLE_JSON,
            default_course_credit: DEFAULT_COURSE_CREDIT
        };
    }
};

const normalizeUser = (rawUser: User): User => ({
    ...rawUser,
    ...resolveUserSettings(rawUser.user_setting)
});

interface AuthContextType {
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSessionExpired, setIsSessionExpired] = useState(false);
    const interceptorIdRef = useRef<number | null>(null);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    }, []);

    const fetchUser = useCallback(async () => {
        try {
            const response = await axios.get<User>('/api/users/me');
            setUser(normalizeUser(response.data));
        } catch (error) {
            console.error("Failed to fetch user", error);
            // Don't call logout here, the interceptor handles 401
            if ((error as any).response?.status !== 401) {
                logout();
            }
        } finally {
            setIsLoading(false);
        }
    }, [logout]);

    const login = useCallback((token: string) => {
        localStorage.setItem('token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsSessionExpired(false); // Clear any previous session expired state
        setIsLoading(true);
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        // Set up axios response interceptor for 401 errors
        interceptorIdRef.current = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    // Session expired - clear auth state and show modal
                    localStorage.removeItem('token');
                    delete axios.defaults.headers.common['Authorization'];
                    setUser(null);
                    setIsSessionExpired(true);
                }
                return Promise.reject(error);
            }
        );

        // Initial auth check
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchUser();
        } else {
            setIsLoading(false);
        }

        // Cleanup interceptor on unmount
        return () => {
            if (interceptorIdRef.current !== null) {
                axios.interceptors.response.eject(interceptorIdRef.current);
            }
        };
    }, [fetchUser]);

    const handleCloseSessionExpiredModal = () => {
        setIsSessionExpired(false);
    };

    const value = useMemo(() => ({
        user,
        login,
        logout,
        refreshUser: fetchUser,
        isLoading
    }), [user, login, logout, fetchUser, isLoading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
            <SessionExpiredModal
                isOpen={isSessionExpired}
                onClose={handleCloseSessionExpiredModal}
            />
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
