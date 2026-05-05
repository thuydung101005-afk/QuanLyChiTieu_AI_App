import { useState, useEffect } from 'react';
import {
    authLogin,
    authSignup,
    authMe,
    authVerifyOtp,
    authResendOtp,
    authForgotPassword,
    authVerifyResetOtp,
    authResetPassword,
} from '../services/api';
import type { AuthMode } from '../types';

const SESSION_KEY = 'finbrain_jwt_token';

export type AuthStep =
    | 'form'
    | 'verify-otp'
    | 'forgot-email'
    | 'forgot-otp'
    | 'forgot-reset';

export interface UserProfile {
    id: string;
    username: string;
    email: string | null;
    is_verified: boolean;
    created_at: string;
}

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [authStep, setAuthStep] = useState<AuthStep>('form');
    const [authUsername, setAuthUsername] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authEmail, setAuthEmail] = useState('');
    const [authError, setAuthError] = useState('');
    const [isRestoring, setIsRestoring] = useState(true);
    const [pendingEmail, setPendingEmail] = useState('');
    const [resetToken, setResetToken] = useState('');

    // --- Auto-restore session ---
    useEffect(() => {
        const storedToken = localStorage.getItem(SESSION_KEY);
        if (!storedToken) { setIsRestoring(false); return; }
        authMe()
            .then((res) => {
                const u = res.data.user;
                setUserId(u.id);
                setUserProfile(u);
                setIsAuthenticated(true);
            })
            .catch(() => localStorage.removeItem(SESSION_KEY))
            .finally(() => setIsRestoring(false));
    }, []);

    const applyLogin = (token: string, user: any) => {
        localStorage.setItem(SESSION_KEY, token);
        setUserId(user.id);
        setUserProfile(user);
        setIsAuthenticated(true);
    };

    const handleLogin = async (): Promise<void> => {
        const res = await authLogin(authUsername, authPassword);
        applyLogin(res.data.token, res.data.user);
    };

    const handleSignup = async (): Promise<void> => {
        await authSignup(authUsername, authPassword, authEmail);
        setPendingEmail(authEmail.toLowerCase().trim());
        setAuthStep('verify-otp');
    };

    const handleVerifyOtp = async (otp: string): Promise<void> => {
        const res = await authVerifyOtp(pendingEmail, otp);
        applyLogin(res.data.token, res.data.user);
    };

    const handleResendOtp = async (type: 'verify' | 'reset' = 'verify'): Promise<void> => {
        await authResendOtp(pendingEmail, type);
    };

    const handleForgotSendOtp = async (email: string): Promise<void> => {
        await authForgotPassword(email);
        setPendingEmail(email.toLowerCase().trim());
        setAuthStep('forgot-otp');
    };

    const handleForgotVerifyOtp = async (otp: string): Promise<void> => {
        const res = await authVerifyResetOtp(pendingEmail, otp);
        setResetToken(res.data.resetToken);
        setAuthStep('forgot-reset');
    };

    const handleForgotReset = async (newPassword: string): Promise<void> => {
        await authResetPassword(resetToken, newPassword);
        setAuthStep('form');
        setAuthMode('login');
        setPendingEmail('');
        setResetToken('');
        setAuthError('✅ Mật khẩu đã được đặt lại! Hãy đăng nhập nhé.');
    };

    const handleAuth = async (): Promise<void> => {
        try {
            setAuthError('');
            if (authMode === 'login') {
                await handleLogin();
            } else {
                await handleSignup();
            }
        } catch (err: any) {
            if (err.response?.data?.needsVerification) {
                setPendingEmail(err.response.data.email);
                setAuthStep('verify-otp');
                setAuthError('Tài khoản chưa xác minh. Vui lòng nhập mã OTP đã gửi vào email.');
                return;
            }
            const msg = err.response?.data?.error || 'Lỗi xác thực!';
            setAuthError(msg);
            throw new Error(msg);
        }
    };

    // Called by ProfileTab after successful email change to refresh JWT + profile
    const updateToken = (newToken: string, newUser: Partial<UserProfile>) => {
        localStorage.setItem(SESSION_KEY, newToken);
        setUserProfile(prev => prev ? { ...prev, ...newUser } : prev);
    };

    const handleLogout = () => {
        localStorage.removeItem(SESSION_KEY);
        setIsAuthenticated(false);
        setUserId(null);
        setUserProfile(null);
        setAuthUsername('');
        setAuthPassword('');
        setAuthEmail('');
        setAuthError('');
        setAuthStep('form');
        setAuthMode('login');
        setPendingEmail('');
        setResetToken('');
    };

    const goToForgotPassword = () => { setAuthError(''); setAuthStep('forgot-email'); };
    const goBackToForm = () => { setAuthError(''); setAuthStep('form'); setPendingEmail(''); setResetToken(''); };

    return {
        isAuthenticated, userId, userProfile,
        authMode, setAuthMode,
        authStep, setAuthStep,
        authUsername, setAuthUsername,
        authPassword, setAuthPassword,
        authEmail, setAuthEmail,
        authError, isRestoring,
        pendingEmail, resetToken,
        handleAuth, handleVerifyOtp, handleResendOtp,
        handleForgotSendOtp, handleForgotVerifyOtp, handleForgotReset,
        handleLogout, updateToken,
        goToForgotPassword, goBackToForm,
    };
}
