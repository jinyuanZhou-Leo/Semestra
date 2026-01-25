import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { SessionExpiredModal } from '../components/SessionExpiredModal';

interface User {
    id: number;
    email: string;
}

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
    }, []);

    const fetchUser = async () => {
        try {
            const response = await axios.get('/api/users/me');
            setUser(response.data);
        } catch (error) {
            console.error("Failed to fetch user", error);
            // Don't call logout here, the interceptor handles 401
            if ((error as any).response?.status !== 401) {
                logout();
            }
        } finally {
            setIsLoading(false);
        }
    };

    const login = (token: string) => {
        localStorage.setItem('token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsSessionExpired(false); // Clear any previous session expired state
        setIsLoading(true);
        fetchUser();
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    const handleCloseSessionExpiredModal = () => {
        setIsSessionExpired(false);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, refreshUser: fetchUser, isLoading }}>
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
