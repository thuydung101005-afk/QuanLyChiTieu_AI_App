import React, { useMemo, useState, useEffect } from 'react';
import { Wallet, Trash2, RefreshCw, Download, Calendar, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { format } from 'date-fns';
import { apiUpdateTransactionJar } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
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
    const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);
    
    // Mặc định chọn Tháng hiện tại và Năm hiện tại
    const currentDate = new Date();
    const [filterMonth, setFilterMonth] = useState<string>((currentDate.getMonth() + 1).toString());
    const [filterYear, setFilterYear] = useState<string>(currentDate.getFullYear().toString());

    // Load more state
    const [visibleCount, setVisibleCount] = useState(5);

    // Reset load more when filter changes
    useEffect(() => {
        setVisibleCount(5);
    }, [filterMonth, filterYear]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const d = new Date(tx.date);
            const m = d.getMonth() + 1;
            const y = d.getFullYear();
            if (filterMonth !== 'all' && m.toString() !== filterMonth) return false;
            if (filterYear !== 'all' && y.toString() !== filterYear) return false;
            return true;
        });
    }, [transactions, filterMonth, filterYear]);

    // Đồng bộ Dữ liệu Biểu Đồ Tròn
    const pieChartData = useMemo(() => {
        if (filterMonth === 'all' && filterYear === 'all') {
            return jars.map(j => ({ name: j.name, value: Math.max(0, j.balance || 0), color: j.color || '#FFD1DA' })).filter(d => d.value > 0);
        } else {
            const expenseMap: Record<string, number> = {};
            filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
                expenseMap[t.jar_id] = (expenseMap[t.jar_id] || 0) + t.amount;
            });
            return jars.map(j => ({
                name: j.name,
                value: expenseMap[j.id] || 0,
                color: j.color || '#FFD1DA'
            })).filter(d => d.value > 0);
        }
    }, [jars, filteredTransactions, filterMonth, filterYear]);

    const totalPieValue = useMemo(() => pieChartData.reduce((s, d) => s + d.value, 0), [pieChartData]);

    // Đồng bộ Dữ liệu Biểu Đồ Cột
    const barChartData = useMemo(() => {
        if (filterMonth !== 'all') {
            const map: Record<number, number> = {};
            const year = filterYear === 'all' ? currentDate.getFullYear() : parseInt(filterYear);
            const month = parseInt(filterMonth);
            const daysInMonth = new Date(year, month, 0).getDate(); 
            
            for (let i = 1; i <= daysInMonth; i++) map[i] = 0;
            
            filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
                const day = new Date(t.date).getDate();
                map[day] += t.amount;
            });
            return Object.entries(map).map(([day, total]) => ({ name: day, total }));
        } else {
            const map: Record<string, number> = {};
            transactions.filter(t => t.type === 'expense').forEach(t => {
                const key = format(new Date(t.date), 'MM/yy');
                map[key] = (map[key] || 0) + t.amount;
            });
            return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, total]) => ({ name: month, total }));
        }
    }, [transactions, filteredTransactions, filterMonth, filterYear, currentDate]);

    // Tổng kết Thu Chi
    const { totalIncome, totalExpense } = useMemo(() => {
        let inc = 0, exp = 0;
        filteredTransactions.forEach(t => {
            if (t.type === 'income') inc += t.amount;
            else exp += t.amount;
        });
        return { totalIncome: inc, totalExpense: exp };
    }, [filteredTransactions]);

    const handleDelete = (tx: Transaction) => {
        setPendingDeleteTx(tx);
    };

    const handleConfirmDelete = async () => {
        if (!pendingDeleteTx) return;
        await onDeleteTransaction(pendingDeleteTx.id);
        setPendingDeleteTx(null);
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
        const rows = filteredTransactions.map(tx => {
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

    // Custom Tooltip for Charts to make it WOW
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50">
                    <p className="text-xs font-bold text-gray-500 mb-1">
                        {filterMonth !== 'all' ? `Ngày ${label}` : label}
                    </p>
                    <p className="text-sm font-extrabold text-pink-500">
                        {payload[0].value.toLocaleString()}đ
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <>
            <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5 pt-2 pb-10"
            >
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-xl font-extrabold text-gray-800">Thống kê</h2>
                    
                    {/* Compact Modern Filter */}
                    <div className="flex gap-2">
                        <div className="relative">
                            <select 
                                value={filterMonth} 
                                onChange={e => setFilterMonth(e.target.value)} 
                                className="appearance-none bg-white text-xs font-bold text-gray-700 border border-gray-100 rounded-xl pl-3 pr-8 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-100 cursor-pointer"
                            >
                                <option value="all">Tất cả tháng</option>
                                {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <select 
                                value={filterYear} 
                                onChange={e => setFilterYear(e.target.value)} 
                                className="appearance-none bg-white text-xs font-bold text-gray-700 border border-gray-100 rounded-xl pl-3 pr-8 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-100 cursor-pointer"
                            >
                                <option value="all">Tất cả năm</option>
                                {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Premium Summary Dashboard */}
                <div className="bg-gradient-to-br from-white to-pink-50/50 rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white relative overflow-hidden">
                    {/* Decorative blurred blobs */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-400/10 rounded-full blur-2xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl"></div>
                    
                    <div className="relative flex justify-between items-center z-10">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                </div>
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tổng Thu</p>
                            </div>
                            <p className="text-xl font-extrabold text-gray-800">+{totalIncome.toLocaleString()}đ</p>
                        </div>
                        
                        <div className="w-px h-12 bg-gray-100 mx-4"></div>
                        
                        <div className="flex-1 text-right">
                            <div className="flex items-center justify-end gap-2 mb-1">
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tổng Chi</p>
                                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                </div>
                            </div>
                            <p className="text-xl font-extrabold text-gray-800">-{totalExpense.toLocaleString()}đ</p>
                        </div>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 gap-5">
                    {/* Pie Chart */}
                    <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-50">
                        <h3 className="text-sm font-extrabold text-gray-800 mb-4 text-center">
                            {filterMonth === 'all' && filterYear === 'all' ? 'Phân Bổ Số Dư Hũ' : 'Cơ Cấu Chi Tiêu Theo Hũ'}
                        </h3>
                        {pieChartData.length > 0 ? (
                            <>
                                <div className="h-52 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieChartData}
                                                cx="50%" cy="50%"
                                                innerRadius={55} outerRadius={75}
                                                paddingAngle={6}
                                                dataKey="value"
                                                nameKey="name"
                                                stroke="none"
                                                label={({ cx, cy, midAngle, outerRadius, value }) => {
                                                    if (!value || value <= 0) return null;
                                                    const RADIAN = Math.PI / 180;
                                                    const radius = outerRadius + 20;
                                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                    const pct = totalPieValue > 0 ? ((value / totalPieValue) * 100).toFixed(0) : '0';
                                                    return (
                                                        <text x={x} y={y} fill="#4b5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 11, fontWeight: 800 }}>
                                                            {`${pct}%`}
                                                        </text>
                                                    );
                                                }}
                                            >
                                                {pieChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                                    {pieChartData.map((d, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="inline-block w-3 h-3 rounded-full shadow-sm" style={{ background: d.color }} />
                                            <span className="text-xs font-bold text-gray-600">{d.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40">
                                <span className="text-3xl mb-2 opacity-50">📊</span>
                                <p className="text-xs text-center text-gray-400 font-bold">Chưa có dữ liệu</p>
                            </div>
                        )}
                    </div>

                    {/* Bar Chart */}
                    {barChartData.length > 0 && (() => {
                        // Tính top 3 giá trị lớn nhất để chỉ hiện label cho chúng
                        const top3Values = [...barChartData]
                            .map(d => d.total)
                            .filter(v => v > 0)
                            .sort((a, b) => b - a)
                            .slice(0, 3);
                        const top3Set = new Set(top3Values);

                        const CustomBarLabel = (props: any) => {
                            const { x, y, width, value } = props;
                            if (!value || value <= 0 || !top3Set.has(value)) return null;
                            return (
                                <text
                                    x={x + width / 2}
                                    y={y - 5}
                                    fill="#f43f5e"
                                    textAnchor="middle"
                                    fontSize={9}
                                    fontWeight={800}
                                >
                                    {`${(value / 1000).toFixed(0)}k`}
                                </text>
                            );
                        };

                        return (
                            <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-50">
                                <h3 className="text-sm font-extrabold text-gray-800 mb-1 text-center">
                                    {filterMonth !== 'all' ? `Biến Động Chi Tiêu Tháng ${filterMonth}` : 'Chi Tiêu 6 Tháng Gần Nhất'}
                                </h3>
                                <p className="text-[10px] text-center text-gray-400 font-medium mb-4">
                                    Hover vào cột để xem chi tiết · Nhãn hiện trên 3 ngày chi nhiều nhất
                                </p>
                                <div className="h-56 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={barChartData} margin={{ top: 18, right: 0, left: -25, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8}/>
                                                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0.4}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickMargin={10} interval="preserveStartEnd" />
                                            <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => v > 0 ? `${(v / 1000).toFixed(0)}k` : '0'} axisLine={false} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="total" fill="url(#barGradient)" radius={[6, 6, 6, 6]} maxBarSize={32}>
                                                <LabelList dataKey="total" content={<CustomBarLabel />} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Transaction List with Load More */}
                <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-sm font-extrabold text-gray-800">Giao dịch chi tiết</h3>
                        <button 
                            onClick={handleExportCSV}
                            className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm flex items-center gap-1.5 hover:text-pink-500 hover:border-pink-200 hover:bg-pink-50 transition-all active:scale-95"
                        >
                            <Download size={14} /> Xuất CSV
                        </button>
                    </div>

                    <div className="space-y-3">
                        <AnimatePresence>
                            {filteredTransactions.slice(0, visibleCount).map(tx => {
                                const jar = jars.find(j => j.id === tx.jar_id);
                                const isIncome = tx.type === 'income';
                                return (
                                    <motion.div 
                                        key={tx.id} 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white rounded-[24px] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-50 flex justify-between items-center hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div
                                                className="w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden"
                                                style={{ backgroundColor: `${jar?.color || '#ccc'}15`, color: jar?.color || '#ccc' }}
                                            >
                                                <Wallet size={20} className="relative z-10" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[15px] font-extrabold text-gray-800 truncate leading-tight mb-1">{tx.description}</p>
                                                <div className="flex gap-2 items-center flex-wrap">
                                                    <span className="text-[11px] font-bold text-gray-400 shrink-0">
                                                        {format(new Date(tx.date), 'dd/MM/yyyy')}
                                                    </span>
                                                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                                                    <button
                                                        onClick={() => setCorrectingTxId(correctingTxId === tx.id ? null : tx.id)}
                                                        className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-bold shrink-0 flex items-center gap-1 hover:bg-pink-100 hover:text-pink-600 transition-colors"
                                                    >
                                                        {jar?.name || 'Khác'} {!isIncome && <RefreshCw size={10} />}
                                                    </button>
                                                    {isIncome && <span className="text-[11px] bg-green-50 text-green-600 px-2 py-0.5 rounded-lg font-bold">Thu nhập</span>}
                                                </div>
                                                <AnimatePresence>
                                                    {correctingTxId === tx.id && !isIncome && (
                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                                                                <p className="text-[11px] text-pink-500 font-bold w-full mb-1">🧠 Đổi hũ để AI tự học:</p>
                                                                {jars.map(j => (
                                                                    <button key={j.id} onClick={() => handleCorrectJar(tx.id, j.id)}
                                                                        className={`text-[11px] px-3 py-1.5 rounded-xl font-bold border transition-all ${j.id === tx.jar_id ? 'bg-pink-100 text-pink-600 border-pink-200' : 'bg-white text-gray-500 border-gray-200 hover:border-pink-300 hover:text-pink-500 shadow-sm'}`}>
                                                                        {j.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 ml-3">
                                            <p className={`text-[15px] font-extrabold ${isIncome ? 'text-green-500' : 'text-gray-800'}`}>
                                                {isIncome ? '+' : '-'}{tx.amount.toLocaleString()}đ
                                            </p>
                                            {!isIncome && (
                                                <button
                                                    onClick={() => handleDelete(tx)}
                                                    className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                                    title="Xóa giao dịch"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {filteredTransactions.length === 0 && (
                            <div className="bg-white rounded-[32px] border border-dashed border-gray-200 py-12 flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-2xl">🍃</span>
                                </div>
                                <p className="text-sm text-gray-400 font-bold">Không có giao dịch nào</p>
                            </div>
                        )}

                        {/* Load More Button */}
                        {visibleCount < filteredTransactions.length && (
                            <motion.button
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                onClick={() => setVisibleCount(prev => prev + 10)}
                                className="w-full py-4 text-sm font-bold text-gray-500 bg-gray-50/50 hover:bg-gray-100 rounded-[24px] transition-colors flex items-center justify-center gap-2 border border-gray-100"
                            >
                                Xem thêm {filteredTransactions.length - visibleCount} giao dịch <ChevronDown size={16} />
                            </motion.button>
                        )}
                    </div>
                </div>
            </motion.div>

            <ConfirmDialog
                open={!!pendingDeleteTx}
                title="Xoá giao dịch?"
                message={pendingDeleteTx ? `Xoá "${pendingDeleteTx.description}" (${pendingDeleteTx.amount.toLocaleString()}đ)? Số tiền sẽ được hoàn lại vào hũ.` : ''}
                confirmLabel="Xoá"
                cancelLabel="Huỷ"
                danger
                onConfirm={handleConfirmDelete}
                onCancel={() => setPendingDeleteTx(null)}
            />
        </>
    );
}
