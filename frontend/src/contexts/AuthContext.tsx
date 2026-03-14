// input:  [httpOnly-cookie auth session, axios `/api/users/me` + 401 interceptor, session modal]
// output: [`AuthProvider` and `useAuth()` exposing user/login/logout/refresh/loading state]
// pos:    [Application-wide authentication context used by route guards and pages via cookie-backed sessions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { SessionExpiredModal } from '../components/SessionExpiredModal';
import { DEFAULT_GPA_SCALING_TABLE_JSON } from '../utils/gpaUtils';
import { queryClient } from '../services/queryClient';
import { queryKeys } from '../services/queryKeys';

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
    login: () => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSessionExpired, setIsSessionExpired] = useState(false);
    const interceptorIdRef = useRef<number | null>(null);
    const userRef = useRef<User | null>(null);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const clearSessionState = useCallback(() => {
        setUser(null);
        queryClient.setQueryData(queryKeys.user.me(), null);
        queryClient.clear();
    }, []);

    const logout = useCallback(async () => {
        try {
            await axios.post('/api/auth/logout');
        } catch (error) {
            console.error("Failed to clear server session", error);
        } finally {
            clearSessionState();
            setIsSessionExpired(false);
            setIsLoading(false);
        }
    }, [clearSessionState]);

    const fetchUser = useCallback(async () => {
        try {
            const response = await axios.get<User>('/api/users/me');
            const normalizedUser = normalizeUser(response.data);
            setUser(normalizedUser);
            queryClient.setQueryData(queryKeys.user.me(), normalizedUser);
        } catch (error) {
            const responseStatus = (error as any).response?.status;
            if (responseStatus === 401) {
                clearSessionState();
            } else {
                console.error("Failed to fetch user", error);
                clearSessionState();
            }
        } finally {
            setIsLoading(false);
        }
    }, [clearSessionState]);

    const login = useCallback(async () => {
        setIsSessionExpired(false);
        setIsLoading(true);
        await fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        interceptorIdRef.current = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    const hadActiveSession = Boolean(userRef.current);
                    clearSessionState();
                    if (hadActiveSession) {
                        setIsSessionExpired(true);
                    }
                }
                return Promise.reject(error);
            }
        );

        void fetchUser();

        return () => {
            if (interceptorIdRef.current !== null) {
                axios.interceptors.response.eject(interceptorIdRef.current);
            }
        };
    }, [clearSessionState, fetchUser]);

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
