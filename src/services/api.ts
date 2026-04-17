import axios from 'axios';
import type { PendingTx } from '../types';

export const api = axios.create({ baseURL: '/api' });

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

export const authSignup = (username: string, password: string) =>
    api.post('/auth/signup', { username, password });

export const authMe = () =>
    api.get(`/auth/me`);

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
