import type { Jar, Transaction } from '../types';

export function generateMonthlySummary(userId: string, monthStr: string, jars: Jar[], transactions: Transaction[]) {
    // monthStr format: 'YYYY-MM' (e.g., '2026-03')
    const [year, month] = monthStr.split('-').map(Number);
    
    // Filter transactions for the requested month
    const monthlyTxs = transactions.filter(tx => {
        const d = new Date(tx.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    // Calculate Totals
    let totalIncome = 0;
    let totalExpense = 0;
    
    const jarSpending: Record<string, number> = {};
    jars.forEach(j => { jarSpending[j.name] = 0; });

    monthlyTxs.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amount;
        } else {
            totalExpense += tx.amount;
            const jar = jars.find(j => j.id === tx.jar_id);
            if (jar) {
                jarSpending[jar.name] += tx.amount;
            }
        }
    });

    // Find the most expensive jar
    let maxJar = '';
    let maxAmount = -1;
    for (const [jarName, amount] of Object.entries(jarSpending)) {
        if (amount > maxAmount) {
            maxAmount = amount;
            maxJar = jarName;
        }
    }

    // Prepare JSON payload
    const recapJSON = {
        userId,
        period: monthStr,
        summary: {
            totalIncome,
            totalExpense,
            netSavings: totalIncome - totalExpense,
        },
        jarSpending,
        highlights: {
            highestSpendingCategory: maxJar,
            highestSpendingAmount: maxAmount
        },
        jarBalances: jars.map(j => ({
            name: j.name,
            balance: j.balance
        }))
    };

    return recapJSON;
}
