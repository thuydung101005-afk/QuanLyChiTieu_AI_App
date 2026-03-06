import axios from 'axios';
import type { PendingTx } from '../types';

export const api = axios.create({ baseURL: '/api' });

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authLogin = (username: string, password: string) =>
    api.post('/auth/login', { username, password });

export const authSignup = (username: string, password: string) =>
    api.post('/auth/signup', { username, password });

export const authMe = (userId: string) =>
    api.get(`/auth/me?userId=${userId}`);

// ─── Jars ────────────────────────────────────────────────────────────────────
export const fetchJars = (userId: string) =>
    api.get(`/jars?userId=${userId}`);

export const apiCreateJar = (userId: string, name: string, allocation_percent: number, color?: string, icon?: string) =>
    api.post('/jars', { userId, name, allocation_percent, color: color || '#FFD1DA', icon: icon || 'piggy-bank' });

export const apiUpdateJar = (jarId: string, userId: string, name: string, allocation_percent: number) =>
    api.put(`/jars/${jarId}`, { userId, name, allocation_percent });

export const apiDeleteJar = (jarId: string, userId: string) =>
    api.delete(`/jars/${jarId}?userId=${userId}`);

// ─── Transactions ─────────────────────────────────────────────────────────────
export const fetchTransactions = (userId: string) =>
    api.get(`/transactions?userId=${userId}`);

export const apiPredictTransaction = (description: string, userId: string) =>
    api.post('/transactions/predict', { description, userId });

export const apiConfirmTransaction = (
    pending: PendingTx,
    selectedJarId: string,
    userId: string
) =>
    api.post('/transactions/confirm', {
        amount: pending.extracted_amount,
        description: pending.extracted_name,
        jar_id: selectedJarId,
        userId,
    });

export const apiDeleteTransaction = (txId: string, userId: string) =>
    api.delete(`/transactions/${txId}?userId=${userId}`);

// ─── Income ───────────────────────────────────────────────────────────────────
export const apiAddIncome = (userId: string, amount: number, description?: string) =>
    api.post('/incomes', { userId, amount, description });

// ─── AI Chat ─────────────────────────────────────────────────────────────────
export const apiSendChat = (message: string, userId: string) =>
    api.post('/chat', { message, userId });
