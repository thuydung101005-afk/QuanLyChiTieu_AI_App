import React, { useMemo, useState } from 'react';
import { Wallet, Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { apiUpdateTransactionJar } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type { Jar, Transaction } from '../types';

interface HistoryTabProps {
    userId: string;
    jars: Jar[];
    transactions: Transaction[];
    onDeleteTransaction: (id: string) => Promise<void>;
    onRefresh: () => Promise<void>;
}

export function HistoryTab({ userId, jars, transactions, onDeleteTransaction, onRefresh }: HistoryTabProps) {
    const toast = useToast();
    const [correctingTxId, setCorrectingTxId] = useState<string | null>(null);
    // Bar chart: group expenses by month
    const monthlyData = useMemo(() => {
        const map: Record<string, number> = {};
        transactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
                const key = format(new Date(t.date), 'MM/yy');
                map[key] = (map[key] || 0) + t.amount;
            });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6)
            .map(([month, total]) => ({ month, total }));
    }, [transactions]);

    const handleDelete = async (tx: Transaction) => {
        const jarName = jars.find(j => j.id === tx.jar_id)?.name || 'hũ';
        const confirmed = window.confirm(
            `Xóa giao dịch "${tx.description}" (${tx.amount.toLocaleString()}đ)?\nSố tiền sẽ được hoàn lại vào "${jarName}".`
        );
        if (!confirmed) return;
        await onDeleteTransaction(tx.id);
    };

    const handleCorrectJar = async (txId: string, newJarId: string) => {
        try {
            await apiUpdateTransactionJar(txId, newJarId);
            setCorrectingTxId(null);
            await onRefresh();
            toast.success('Đã cập nhật hũ và AI đã tự học xong!');
        } catch { toast.error('Lỗi khi cập nhật hũ!'); }
    };

    const handleExportCSV = () => {
        const header = ["ID", "Ngày", "Loại", "Danh mục (Hũ)", "Số tiền", "Mô tả"];
        const rows = transactions.map(tx => {
            const jarName = jars.find(j => j.id === tx.jar_id)?.name || 'Khác';
            const type = tx.type === 'income' ? 'Thu nhập' : 'Chi tiêu';
            const date = new Date(tx.date).toLocaleDateString('vi-VN');
            return [tx.id, date, type, jarName, tx.amount, `"${tx.description.replace(/"/g, '""')}"`];
        });
        
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + [header.join(","), ...rows.map(e => e.join(","))].join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `lich_su_giao_dich_${format(new Date(), 'ddMMyyyy')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <motion.div
            key="history"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4 pt-4 pb-10"
        >
            <h2 className="text-xl font-extrabold text-gray-800 text-center mb-2">Biểu Đồ & Lịch Sử</h2>

            {/* Pie Chart – Jar balances */}
            <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-pink-50">
                <h3 className="text-sm font-extrabold text-gray-700 mb-4 text-center">Phân Bổ Số Dư Hũ</h3>
                {jars.length > 0 ? (
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={jars} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="balance" nameKey="name">
                                    {jars.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color || '#FFD1DA'} opacity={entry.balance > 0 ? 1 : 0.3} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `${value.toLocaleString()}đ`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-xs text-center text-gray-400 font-medium py-2">Chưa có dữ liệu</p>
                )}
            </div>

            {/* Bar Chart – Monthly expenses */}
            {monthlyData.length > 0 && (
                <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-pink-50">
                    <h3 className="text-sm font-extrabold text-gray-700 mb-4 text-center">Chi Tiêu Theo Tháng</h3>
                    <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} />
                                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(v: number) => `${v.toLocaleString()}đ`} />
                                <Bar dataKey="total" fill="#FFB5A7" radius={[6, 6, 0, 0]} name="Chi tiêu" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Transaction List */}
            <div className="space-y-3">
                <div className="flex justify-between items-center mb-2 px-1">
                    <h3 className="text-sm font-extrabold text-gray-700">Tất cả giao dịch</h3>
                    <button 
                        onClick={handleExportCSV}
                        className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 hover:text-[#FF7FA3] hover:border-pink-200 transition-colors"
                    >
                        <Download size={14} /> Xuất CSV
                    </button>
                </div>
                {transactions.map(tx => {
                    const jar = jars.find(j => j.id === tx.jar_id);
                    const isIncome = tx.type === 'income';
                    return (
                        <div key={tx.id} className="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div
                                    className="w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 shadow-inner"
                                    style={{ backgroundColor: `${jar?.color || '#ccc'}20`, color: jar?.color || '#ccc' }}
                                >
                                    <Wallet size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-gray-800 truncate">{tx.description}</p>
                                    <div className="flex gap-2 items-center mt-0.5 flex-wrap">
                                        <button
                                            onClick={() => setCorrectingTxId(correctingTxId === tx.id ? null : tx.id)}
                                            className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold shrink-0 flex items-center gap-1 hover:bg-pink-100 hover:text-pink-500 transition-colors"
                                        >
                                            {jar?.name}{!isIncome && <RefreshCw size={8} />}
                                        </button>
                                        <span className="text-[10px] text-gray-400 font-medium shrink-0">
                                            {new Date(tx.date).toLocaleDateString('vi-VN')}
                                        </span>
                                        {isIncome && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">Thu nhập</span>}
                                    </div>
                                    <AnimatePresence>
                                        {correctingTxId === tx.id && !isIncome && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                                                    <p className="text-[10px] text-pink-400 font-bold w-full mb-1">🧠 Sửa lại → AI sẽ tự học:</p>
                                                    {jars.map(j => (
                                                        <button key={j.id} onClick={() => handleCorrectJar(tx.id, j.id)}
                                                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition-all ${j.id === tx.jar_id ? 'bg-pink-100 text-pink-500 border-pink-200' : 'bg-white text-gray-500 border-gray-200 hover:border-pink-300'}`}>
                                                            {j.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                <p className={`text-sm font-extrabold ${isIncome ? 'text-green-500' : 'text-red-400'}`}>
                                    {isIncome ? '+' : '-'}{tx.amount.toLocaleString()}đ
                                </p>
                                {!isIncome && (
                                    <button
                                        onClick={() => handleDelete(tx)}
                                        className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Xóa giao dịch"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {transactions.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-4xl mb-3">🐣</p>
                        <p className="text-sm text-gray-400 font-medium">Chưa có giao dịch nào</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
