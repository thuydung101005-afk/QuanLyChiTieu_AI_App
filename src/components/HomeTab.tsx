import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, ChevronRight, Home, Gamepad2, TrendingUp, BookOpen, PiggyBank, Heart, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Jar, Transaction } from '../types';
import { apiGetBudget, apiSetBudget } from '../services/api';
import { InsightsCarousel } from './InsightsCarousel';

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
    'home': Home, 'gamepad': Gamepad2, 'trending-up': TrendingUp,
    'book-open': BookOpen, 'piggy-bank': PiggyBank, 'heart': Heart,
};

interface HomeTabProps {
    userId: string;
    jars: Jar[];
    transactions: Transaction[];
    totalBalance: number;
    onViewHistory: () => void;
}

export function HomeTab({ userId, jars, transactions, totalBalance, onViewHistory }: HomeTabProps) {
    const [selectedJar, setSelectedJar] = useState<Jar | null>(null);

    const DEFAULT_BUDGET = 5000000;
    const [monthlyBudget, setMonthlyBudget] = useState<number>(DEFAULT_BUDGET);
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [budgetInput, setBudgetInput] = useState(DEFAULT_BUDGET.toString());
    const [isSavingBudget, setIsSavingBudget] = useState(false);

    // Load budget từ DB khi mount hoặc khi userId thay đổi
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await apiGetBudget();
                if (cancelled) return;
                const value = Number(res.data?.monthly_budget);
                if (Number.isFinite(value)) {
                    setMonthlyBudget(value);
                    setBudgetInput(value.toString());
                }
            } catch (err) {
                // Fallback: nếu API lỗi, thử đọc localStorage cũ để migration mượt
                const legacy = localStorage.getItem(`monthlyBudget_${userId}`) || localStorage.getItem('monthlyBudget');
                if (legacy) {
                    const val = parseInt(legacy);
                    if (Number.isFinite(val)) {
                        setMonthlyBudget(val);
                        setBudgetInput(val.toString());
                    }
                }
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    const handleSaveBudget = async () => {
        const val = parseInt(budgetInput.replace(/\D/g, '')) || 0;
        setIsSavingBudget(true);
        try {
            await apiSetBudget(val);
            setMonthlyBudget(val);
            // Dọn rác localStorage cũ để tránh nhiễu
            localStorage.removeItem(`monthlyBudget_${userId}`);
            localStorage.removeItem('monthlyBudget');
            setIsEditingBudget(false);
        } catch (err) {
            // Nếu API lỗi, vẫn cập nhật UI để không chặn user, lưu tạm vào localStorage
            setMonthlyBudget(val);
            localStorage.setItem(`monthlyBudget_${userId}`, val.toString());
            setIsEditingBudget(false);
        } finally {
            setIsSavingBudget(false);
        }
    };

    // 1. Calculate this month's budget pool
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const thisMonthTxs = transactions.filter(tx => {
        const d = new Date(tx.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalIncomeThisMonth = thisMonthTxs
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0);

    const totalExpenseThisMonth = thisMonthTxs
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0);

    // Filter transactions for the selected jar
    const selectedJarTxs = selectedJar 
        ? transactions.filter(tx => tx.jar_id === selectedJar.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        : [];

    return (
        <motion.div
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 pt-2"
        >
            {/* Brain 2 — Insights Carousel */}
            <InsightsCarousel refreshKey={transactions.length} />

            {/* 6 Jars Grid */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-extrabold text-gray-700">{jars.length} Cái Hũ (Jars)</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {jars.map((jar) => {
                        const Icon = ICONS[jar.icon] || Home;

                        // Calculate logic for progress bar
                        const spent = thisMonthTxs
                            .filter(tx => tx.type === 'expense' && tx.jar_id === jar.id)
                            .reduce((sum, tx) => sum + tx.amount, 0);

                        // Tổng tiền khả dụng của hũ = Số dư hiện tại + Số tiền đã chi
                        const totalAvailable = jar.balance + spent;
                        const percentSpent = totalAvailable > 0 ? (spent / totalAvailable) * 100 : (spent > 0 ? 100 : 0);

                        let progressColor = 'bg-green-400';
                        if (percentSpent > 100) progressColor = 'bg-red-500';
                        else if (percentSpent >= 80) progressColor = 'bg-orange-400';
                        else if (percentSpent === 0) progressColor = 'bg-gray-200';

                        return (
                            <div
                                key={jar.id}
                                onClick={() => setSelectedJar(jar)}
                                className="bg-white rounded-[28px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform cursor-pointer select-none relative active:scale-95"
                            >
                                <div
                                    className="w-12 h-12 rounded-[18px] flex items-center justify-center mb-3 shadow-inner"
                                    style={{ backgroundColor: `${jar.color}20`, color: jar.color }}
                                >
                                    <Icon size={24} strokeWidth={2.5} />
                                </div>
                                <p className="text-xs font-bold text-gray-500 mb-1 line-clamp-1 w-full text-ellipsis">
                                    {jar.name} ({jar.allocation_percent}%)
                                </p>
                                <p className="text-sm font-extrabold text-gray-800">
                                    {jar.balance.toLocaleString()}đ
                                </p>

                                {/* Progress Bar UI */}
                                <div className="w-full mt-2">
                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${progressColor} transition-all duration-500`}
                                            style={{ width: `${Math.min(percentSpent, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-medium mt-1">
                                        Đã chi: {Math.round(percentSpent)}%
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Monthly Budget Section */}
            <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-pink-50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-extrabold text-gray-700">Hạn mức chi tiêu tháng {currentMonth + 1}</h3>
                    {!isEditingBudget && (
                        <button onClick={() => { setBudgetInput(monthlyBudget.toString()); setIsEditingBudget(true); }} className="text-xs font-bold text-[#FF7FA3] hover:opacity-80">
                            Sửa
                        </button>
                    )}
                </div>

                {isEditingBudget ? (
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            inputMode="numeric" 
                            value={budgetInput} 
                            onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ''))} 
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-pink-300"
                            placeholder="Nhập hạn mức..."
                            autoFocus
                            disabled={isSavingBudget}
                            data-testid="budget-input"
                        />
                        <button
                            onClick={handleSaveBudget}
                            disabled={isSavingBudget}
                            className="bg-pink-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-pink-600 disabled:opacity-60 disabled:cursor-not-allowed"
                            data-testid="budget-save-btn"
                        >
                            {isSavingBudget ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-2xl font-black text-gray-800">
                                {totalExpenseThisMonth.toLocaleString()}đ
                            </p>
                            <p className="text-xs font-bold text-gray-400 mb-1">
                                / {monthlyBudget.toLocaleString()}đ
                            </p>
                        </div>
                        
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${totalExpenseThisMonth > monthlyBudget ? 'bg-red-500' : 'bg-gradient-to-r from-pink-400 to-purple-500'}`}
                                style={{ width: `${Math.min((totalExpenseThisMonth / (monthlyBudget || 1)) * 100, 100)}%` }}
                            />
                        </div>
                        
                        <p className={`text-xs font-bold mt-2 ${totalExpenseThisMonth > monthlyBudget ? 'text-red-500' : 'text-gray-500'}`}>
                            {totalExpenseThisMonth > monthlyBudget 
                                ? `⚠️ Vượt hạn mức ${(totalExpenseThisMonth - monthlyBudget).toLocaleString()}đ` 
                                : `Còn lại ${(monthlyBudget - totalExpenseThisMonth).toLocaleString()}đ`}
                        </p>
                    </div>
                )}
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-pink-50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-extrabold text-gray-700">Chi tiêu mới nhất</h3>
                    <button onClick={onViewHistory} className="text-xs font-bold text-[#FF7FA3] flex items-center hover:opacity-80">
                        Xem full <ChevronRight size={14} />
                    </button>
                </div>
                <div className="space-y-3">
                    {transactions.slice(0, 3).map(tx => {
                        const jar = jars.find(j => j.id === tx.jar_id);
                        const isIncome = tx.type === 'income';
                        return (
                            <div key={tx.id} className="flex justify-between items-center p-3 rounded-2xl bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: `${jar?.color || '#ccc'}20`, color: jar?.color || '#ccc' }}
                                    >
                                        <Wallet size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-700">{tx.description}</p>
                                        <p className="text-xs font-semibold text-gray-400">{jar?.name}</p>
                                    </div>
                                </div>
                                <p className={`text-sm font-bold ${isIncome ? 'text-green-500' : 'text-red-400'}`}>
                                    {isIncome ? '+' : '-'}{tx.amount.toLocaleString()}đ
                                </p>
                            </div>
                        );
                    })}
                    {transactions.length === 0 && (
                        <p className="text-xs text-center text-gray-400 font-medium py-2">Chưa có giao dịch nào 🐣</p>
                    )}
                </div>
            </div>

            {/* Jar Details Modal */}
            {document.getElementById('app-modal-root') && createPortal(
                <AnimatePresence>
                    {selectedJar && (
                        <div className="absolute inset-0 z-50 flex flex-col justify-end pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/30 pointer-events-auto backdrop-blur-sm"
                            onClick={() => setSelectedJar(null)}
                        />
                        <motion.div
                            initial={{ y: '100%', opacity: 0.5 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative bg-white w-full max-h-[85vh] rounded-t-[40px] p-6 pb-24 shadow-2xl pointer-events-auto flex flex-col"
                            style={{ borderTop: `8px solid ${selectedJar.color}` }}
                        >
                            <button 
                                onClick={() => setSelectedJar(null)}
                                className="absolute top-4 right-4 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"
                            >
                                <X size={20} />
                            </button>
                            
                            <div className="flex items-center gap-4 mb-6 mt-2">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
                                    style={{ backgroundColor: `${selectedJar.color}20`, color: selectedJar.color }}
                                >
                                    {React.createElement(ICONS[selectedJar.icon] || Home, { size: 32, strokeWidth: 2.5 })}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold text-gray-800">{selectedJar.name}</h2>
                                    <p className="text-sm font-bold text-gray-500">Số dư: <span style={{ color: selectedJar.color }}>{selectedJar.balance.toLocaleString()}đ</span></p>
                                </div>
                            </div>

                            <h3 className="text-sm font-extrabold text-gray-700 mb-4 px-1">Lịch sử chi tiêu</h3>
                            
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 no-scrollbar">
                                {selectedJarTxs.length === 0 ? (
                                    <div className="py-10 text-center flex flex-col items-center opacity-60">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                            <PiggyBank size={28} className="text-gray-400" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-500">Chưa có giao dịch ở hũ này</p>
                                    </div>
                                ) : (
                                    selectedJarTxs.map(tx => {
                                        const isIncome = tx.type === 'income';
                                        return (
                                            <div key={tx.id} className="flex justify-between items-center p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">{tx.description}</p>
                                                    <p className="text-[11px] font-semibold text-gray-400 mt-1">
                                                        {new Date(tx.date).toLocaleDateString('vi-VN')}
                                                    </p>
                                                </div>
                                                <p className={`text-base font-extrabold ${isIncome ? 'text-green-500' : 'text-red-500'}`}>
                                                    {isIncome ? '+' : '-'}{tx.amount.toLocaleString()}đ
                                                </p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
                </AnimatePresence>,
                document.getElementById('app-modal-root')!
            )}
        </motion.div>
    );
}
