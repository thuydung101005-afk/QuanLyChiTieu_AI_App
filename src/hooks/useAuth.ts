import { useState, useEffect } from 'react';
import { authLogin, authSignup, authMe } from '../services/api';
import type { AuthMode } from '../types';

const SESSION_KEY = 'finbrain_jwt_token';

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [authUsername, setAuthUsername] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isRestoring, setIsRestoring] = useState(true); // true while checking localStorage

    // --- Auto-restore session from localStorage on mount ---
    useEffect(() => {
        const storedToken = localStorage.getItem(SESSION_KEY);
        if (!storedToken) {
            setIsRestoring(false);
            return;
        }
        authMe()
            .then((res) => {
                setUserId(res.data.user.id);
                setIsAuthenticated(true);
            })
            .catch(() => {
                // Session invalid – clear storage
                localStorage.removeItem(SESSION_KEY);
            })
            .finally(() => setIsRestoring(false));
    }, []);

    const handleAuth = async () => {
        try {
            setAuthError('');
            if (authMode === 'login') {
                const res = await authLogin(authUsername, authPassword);
                const token = res.data.token;
                const id = res.data.user.id;
                
                localStorage.setItem(SESSION_KEY, token);
                setUserId(id);
                setIsAuthenticated(true);
            } else {
                await authSignup(authUsername, authPassword);
                setAuthMode('login');
                setAuthError('✅ Đăng ký thành công! Hãy đăng nhập nhé.');
            }
        } catch (err: any) {
            setAuthError(err.response?.data?.error || 'Lỗi xác thực!');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem(SESSION_KEY);
        setIsAuthenticated(false);
        setUserId(null);
        setAuthUsername('');
        setAuthPassword('');
        setAuthError('');
    };

    return {
        isAuthenticated,
        userId,
        authMode,
        setAuthMode,
        authUsername,
        setAuthUsername,
        authPassword,
        setAuthPassword,
        authError,
        isRestoring,
        handleAuth,
        handleLogout,
    };
}
