import { useState, useCallback } from 'react';
import { fetchJars, fetchTransactions, apiDeleteTransaction } from '../services/api';
import type { Jar, Transaction } from '../types';

export function useFinanceData(userId: string | null) {
    const [jars, setJars] = useState<Jar[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const fetchDashboardData = useCallback(async () => {
        if (!userId) return;
        try {
            const [jarsRes, txRes] = await Promise.all([
                fetchJars(),
                fetchTransactions(),
            ]);
            setJars(jarsRes.data);
            setTransactions(txRes.data);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }, [userId]);

    const deleteTransaction = async (txId: string) => {
        if (!userId) return;
        await apiDeleteTransaction(txId);
        await fetchDashboardData();
    };

    const totalBalance = jars.reduce((acc, jar) => acc + jar.balance, 0);

    return {
        jars,
        transactions,
        totalBalance,
        fetchDashboardData,
        deleteTransaction,
    };
}
