import axios from 'axios';
import type { PendingTx } from '../types';

// =========================================================================
// 🚀 DÁN LINK NGROK HOẶC IP LOCAL VÀO ĐÂY ĐỂ ĐÓNG GÓI ANDROID
// Ví dụ IP Local: 'http://192.168.0.120:3001/api' (Dùng chung mạng WiFi)
// =========================================================================
const NGROK_URL = 'https://phobia-canola-womanless.ngrok-free.dev/api'; 

export const api = axios.create({ 
    baseURL: NGROK_URL || '/api',
    headers: {
        'ngrok-skip-browser-warning': 'true'
    }
});

const SESSION_KEY = 'finbrain_jwt_token';

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem(SESSION_KEY);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authLogin = (username: string, password: string) =>
    api.post('/auth/login', { username, password });

export const authSignup = (username: string, password: string, email: string) =>
    api.post('/auth/signup', { username, password, email });

export const authVerifyOtp = (email: string, otp: string) =>
    api.post('/auth/verify-otp', { email, otp });

export const authResendOtp = (email: string, type: 'verify' | 'reset' = 'verify') =>
    api.post('/auth/resend-otp', { email, type });

export const authForgotPassword = (email: string) =>
    api.post('/auth/forgot-password', { email });

export const authVerifyResetOtp = (email: string, otp: string) =>
    api.post('/auth/verify-reset-otp', { email, otp });

export const authResetPassword = (resetToken: string, newPassword: string) =>
    api.post('/auth/reset-password', { resetToken, newPassword });

export const authMe = () =>
    api.get(`/auth/me`);

export const apiChangePassword = (oldPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { oldPassword, newPassword });

export const apiRequestEmailChange = (newEmail: string) =>
    api.post('/auth/change-email/request', { newEmail });

export const apiVerifyEmailChange = (newEmail: string, otp: string) =>
    api.post('/auth/change-email/verify', { newEmail, otp });

export const apiGetNotifications = () => 
    api.get('/auth/notifications');

export const apiMarkNotificationRead = (id: string) => 
    api.put(`/auth/notifications/${id}/read`);

export const apiMarkAllNotificationsRead = () => 
    api.put('/auth/notifications/read-all');

export const apiTriggerMonthlyAIReport = () =>
    api.post('/auth/notifications/trigger-monthly-ai');

// ─── Jars ────────────────────────────────────────────────────────────────────
export const fetchJars = () =>
    api.get(`/jars`);

export const apiCreateJar = (name: string, split_amount: number, concept_type: string, sourceJarId?: string, color?: string, icon?: string) => 
    api.post('/jars', { name, split_amount, concept_type, sourceJarId, color, icon });

export const apiBulkUpdateJars = (updates: { id: string, percent: number }[]) => 
    api.put('/jars/bulk', { updates });

export const apiUpdateJar = (jarId: string, name: string, allocation_percent: number) =>
    api.put(`/jars/${jarId}`, { name, allocation_percent });

export const apiDeleteJar = (jarId: string) =>
    api.delete(`/jars/${jarId}`);

// ─── Transactions ─────────────────────────────────────────────────────────────
export const fetchTransactions = () =>
    api.get(`/transactions`);

export const apiPredictTransaction = (description: string) => {
    return api.post('/transactions/predict', { description });
};

export const apiConfirmTransaction = (pendingTx: PendingTx, jarId: string, isRecurring?: boolean) => {
    return api.post('/transactions/confirm', {
        amount: pendingTx.extracted_amount,
        description: pendingTx.extracted_name,
        jar_id: jarId,
        predicted_jar_id: pendingTx.predicted_jar_id,
        is_recurring: isRecurring
    });
};

export const apiDeleteTransaction = (txId: string) =>
    api.delete(`/transactions/${txId}`);

export const apiUpdateTransactionJar = (txId: string, newJarId: string) =>
    api.put(`/transactions/${txId}/jar`, { newJarId });

// ─── Income ───────────────────────────────────────────────────────────────────
export const apiAddIncome = (amount: number, description?: string, isRecurring?: boolean) => {
    return api.post('/incomes', { amount, description, is_recurring: isRecurring });
};

// ─── AI Chat ─────────────────────────────────────────────────────────────────
export const apiSendChat = (message: string) =>
    api.post('/chat', { message });

// ─── Monthly Budget ──────────────────────────────────────────────────────────
export const apiGetBudget = () =>
    api.get('/budget');

export const apiSetBudget = (monthlyBudget: number) =>
    api.put('/budget', { monthly_budget: monthlyBudget });

// ─── Brain 2: Insights ───────────────────────────────────────────────────────
export const apiGetInsights = () =>
    api.get('/insights');

export const apiDismissInsight = (id: string) =>
    api.put(`/insights/${id}/dismiss`);

export const apiGetSpikeTxIds = () =>
    api.get('/insights/spike-tx-ids');
