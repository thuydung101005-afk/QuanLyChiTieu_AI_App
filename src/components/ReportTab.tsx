import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Jar, Transaction } from '../types';
import { apiTriggerMonthlyAIReport } from '../services/api';

interface ReportTabProps {
    jars: Jar[];
    transactions: Transaction[];
    onAIReportSent?: () => void;
}

export function ReportTab({ jars, transactions, onAIReportSent }: ReportTabProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    const handleTriggerAIReport = async () => {
        setIsGenerating(true);
        setToastMsg(null);
        try {
            const res = await apiTriggerMonthlyAIReport();
            if (res.data.success === false) {
                setToastMsg(`⚠️ ${res.data.message}`);
            } else {
                setToastMsg('✨ Trợ lý AI đã gửi báo cáo! Hãy kiểm tra chuông thông báo nhé 🔔');
                onAIReportSent?.();
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Có lỗi xảy ra, thử lại sau nhé!';
            setToastMsg(`❌ ${msg}`);
        } finally {
            setIsGenerating(false);
            setTimeout(() => setToastMsg(null), 7000);
        }
    };

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
            {/* Header + AI Button */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-gray-800">Báo Cáo Phân Tích</h2>
                <motion.button
                    onClick={handleTriggerAIReport}
                    disabled={isGenerating}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-white shadow-lg disabled:opacity-70"
                    style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
                >
                    {isGenerating ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Sparkles size={14} />
                    )}
                    {isGenerating ? 'Đang xử lý...' : 'Nhận Lời khuyên AI'}
                </motion.button>
            </div>

            {/* Toast notification */}
            {toastMsg && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-semibold text-center px-4 py-3 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #fdf4ff, #fce7f3)', color: '#9333ea', border: '1px solid #e9d5ff' }}
                >
                    {toastMsg}
                </motion.div>
            )}

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
