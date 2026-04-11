// input:  [httpOnly-cookie auth session, axios `/api/users/me` + auth submit endpoints, normalized user-setting defaults, app-side user query keys, auth redirect persistence, and session modal]
// output: [`AuthProvider` and `useAuth()` exposing user/login/logout/clear-session/refresh/setActiveProgram/loading state plus parsed global user preferences]
// pos:    [Application-wide authentication context used by route guards and pages via cookie-backed sessions, session-expiry route restoration, destructive account-removal session clearing, normalized user-setting hydration, and active-Program routing state]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { userKeys } from '@/data/keys';
import { SessionExpiredModal } from '../components/SessionExpiredModal';
import { DEFAULT_GPA_SCALING_TABLE_JSON } from '../utils/gpaUtils';
import { queryClient } from '../services/queryClient';
import { clearAuthRedirectTarget, rememberCurrentAuthRedirectTarget } from '../utils/authRedirect';

const DEFAULT_COURSE_CREDIT = 0.5;
const AUTH_SESSION_IGNORE_401_PATHS = new Set([
    '/api/auth/token',
    '/api/auth/google',
    '/api/auth/register/complete',
    '/api/auth/email/send-code',
    '/api/auth/email/verify-code',
    '/api/auth/login/email',
    '/api/auth/password-reset/complete',
]);

interface User {
    id: string;
    email: string;
    nickname?: string;
    user_setting?: string | null;
    gpa_scaling_table?: string;
    default_course_credit?: number;
    background_plugin_preload?: boolean;
    active_program_id?: string | null;
    google_sub?: string | null;
    email_verified_at?: string | null;
}

type UserSettings = Pick<User, 'gpa_scaling_table' | 'default_course_credit' | 'background_plugin_preload' | 'active_program_id'>;

const resolveUserSettings = (rawSetting?: string | null): UserSettings => {
    if (!rawSetting) {
        return {
            gpa_scaling_table: DEFAULT_GPA_SCALING_TABLE_JSON,
            default_course_credit: DEFAULT_COURSE_CREDIT,
            background_plugin_preload: true,
            active_program_id: null,
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
        const activeProgramId =
            typeof parsed.active_program_id === 'string' && parsed.active_program_id.trim()
                ? parsed.active_program_id.trim()
                : null;

        return {
            gpa_scaling_table: gpaScalingTable,
            default_course_credit: defaultCourseCredit,
            background_plugin_preload:
                typeof parsed.background_plugin_preload === 'boolean'
                    ? parsed.background_plugin_preload
                    : true,
            active_program_id: activeProgramId,
        };
    } catch {
        return {
            gpa_scaling_table: DEFAULT_GPA_SCALING_TABLE_JSON,
            default_course_credit: DEFAULT_COURSE_CREDIT,
            background_plugin_preload: true,
            active_program_id: null,
        };
    }
};

const normalizeUser = (rawUser: User): User => ({
    ...rawUser,
    ...resolveUserSettings(rawUser.user_setting)
});

const shouldIgnoreSessionExpiryForRequest = (url?: string): boolean => {
    if (!url) {
        return false;
    }

    try {
        const resolvedUrl = new URL(url, window.location.origin);
        return AUTH_SESSION_IGNORE_401_PATHS.has(resolvedUrl.pathname);
    } catch {
        return false;
    }
};

interface AuthContextType {
    user: User | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    clearSession: () => void;
    refreshUser: () => Promise<void>;
    setActiveProgram: (programId: string | null) => Promise<void>;
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
        queryClient.setQueryData(userKeys.me(), null);
        queryClient.clear();
    }, []);

    const clearSession = useCallback(() => {
        clearAuthRedirectTarget();
        clearSessionState();
        setIsSessionExpired(false);
        setIsLoading(false);
    }, [clearSessionState]);

    const logout = useCallback(async () => {
        try {
            await axios.post('/api/auth/logout');
        } catch (error) {
            console.error("Failed to clear server session", error);
        } finally {
            clearSession();
        }
    }, [clearSession]);

    const fetchUser = useCallback(async () => {
        try {
            const response = await axios.get<User>('/api/users/me');
            const normalizedUser = normalizeUser(response.data);
            setUser(normalizedUser);
            queryClient.setQueryData(userKeys.me(), normalizedUser);
        } catch (error) {
            const responseStatus = axios.isAxiosError(error) ? error.response?.status : null;
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

    const setActiveProgram = useCallback(async (programId: string | null) => {
        const response = await axios.put<User>('/api/users/me', {
            user_setting: JSON.stringify({ active_program_id: programId }),
        });
        const normalizedUser = normalizeUser(response.data);
        setUser(normalizedUser);
        queryClient.setQueryData(userKeys.me(), normalizedUser);
    }, []);

    useEffect(() => {
        interceptorIdRef.current = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (
                    error.response?.status === 401 &&
                    !shouldIgnoreSessionExpiryForRequest(error.config?.url)
                ) {
                    const hadActiveSession = Boolean(userRef.current);
                    if (hadActiveSession) {
                        rememberCurrentAuthRedirectTarget();
                    }
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
        clearSession,
        refreshUser: fetchUser,
        setActiveProgram,
        isLoading
    }), [user, login, logout, clearSession, fetchUser, setActiveProgram, isLoading]);

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
