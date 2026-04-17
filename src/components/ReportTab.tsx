import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { Jar, Transaction } from '../types';

interface ReportTabProps {
    jars: Jar[];
    transactions: Transaction[];
}

export function ReportTab({ jars, transactions }: ReportTabProps) {
    // 1. Dữ liệu Pie Chart: % Chi tiêu theo Hũ trong tháng hiện tại
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    const pieData = useMemo(() => {
        const spentByJar: Record<string, number> = {};
        jars.forEach(j => { spentByJar[j.id] = 0; });

        transactions.forEach(tx => {
            if (tx.type === 'expense') {
                const txDate = new Date(tx.date);
                if (isWithinInterval(txDate, { start: currentMonthStart, end: currentMonthEnd })) {
                    spentByJar[tx.jar_id] = (spentByJar[tx.jar_id] || 0) + tx.amount;
                }
            }
        });

        return jars.map(j => ({
            name: j.name,
            value: spentByJar[j.id] || 0,
            color: j.color
        })).filter(d => d.value > 0);
    }, [jars, transactions]);

    // 2. Dữ liệu Bar Chart: So sánh Thu vs Chi 6 tháng gần nhất
    const barData = useMemo(() => {
        const last6Months = Array.from({ length: 6 }).map((_, i) => format(subMonths(new Date(), 5 - i), 'MM/yyyy'));
        const aggregated: Record<string, { month: string; income: number; expense: number }> = {};
        
        last6Months.forEach(m => { aggregated[m] = { month: m, income: 0, expense: 0 }; });

        transactions.forEach(tx => {
            const key = format(new Date(tx.date), 'MM/yyyy');
            if (aggregated[key]) {
                if (tx.type === 'income') aggregated[key].income += tx.amount;
                else aggregated[key].expense += tx.amount;
            }
        });

        return Object.values(aggregated);
    }, [transactions]);

    const totalExpense = pieData.reduce((sum, item) => sum + item.value, 0);

    return (
        <motion.div
            key="report"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 pt-2 pb-10"
        >
            <h2 className="text-xl font-extrabold text-gray-800 text-center mb-2">Báo Cáo Phân Tích</h2>

            {/* Chi tiêu tháng này */}
            <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-pink-50">
                <h3 className="text-sm font-extrabold text-gray-700 mb-2 text-center">
                    Cơ cấu chi tiêu tháng {format(new Date(), 'M')}
                </h3>
                <p className="text-center text-2xl font-black text-[#FF7FA3] mb-4">
                    {totalExpense.toLocaleString()}đ
                </p>
                {pieData.length > 0 ? (
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={pieData} 
                                    cx="50%" cy="50%" 
                                    innerRadius={55} outerRadius={75} 
                                    paddingAngle={5} 
                                    dataKey="value" 
                                    nameKey="name"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color || '#FFD1DA'} />
                                    ))}
                                </Pie>
                                <RechartsTooltip formatter={(value: number) => `${value.toLocaleString()}đ`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-xs text-center text-gray-400 font-medium py-8">Chưa có chi tiêu nào tháng này 🐣</p>
                )}
            </div>

            {/* Thu Chi 6 Tháng */}
            <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-pink-50">
                <h3 className="text-sm font-extrabold text-gray-700 mb-6 text-center">Thu - Chi 6 tháng qua</h3>
                <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                            <RechartsTooltip cursor={{fill: 'transparent'}} formatter={(v: number) => `${v.toLocaleString()}đ`} />
                            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                            <Bar dataKey="income" fill="#4ade80" radius={[4, 4, 0, 0]} name="Thu nhập" barSize={12} />
                            <Bar dataKey="expense" fill="#FFB5A7" radius={[4, 4, 0, 0]} name="Chi tiêu" barSize={12} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </motion.div>
    );
}
