import React from 'react';
import { Wallet, ChevronRight, Home, Gamepad2, TrendingUp, BookOpen, PiggyBank, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import type { Jar, Transaction } from '../types';

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
    'home': Home, 'gamepad': Gamepad2, 'trending-up': TrendingUp,
    'book-open': BookOpen, 'piggy-bank': PiggyBank, 'heart': Heart,
};

interface HomeTabProps {
    jars: Jar[];
    transactions: Transaction[];
    totalBalance: number;
    onViewHistory: () => void;
}

export function HomeTab({ jars, transactions, totalBalance, onViewHistory }: HomeTabProps) {
    return (
        <motion.div
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 pt-2"
        >
            {/* 6 Jars Grid */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-extrabold text-gray-700">6 Cái Hũ (Jars)</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {jars.map((jar) => {
                        const Icon = ICONS[jar.icon] || Home;
                        return (
                            <div
                                key={jar.id}
                                className="bg-white rounded-[28px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform cursor-pointer"
                            >
                                <div
                                    className="w-12 h-12 rounded-[18px] flex items-center justify-center mb-3 shadow-inner"
                                    style={{ backgroundColor: `${jar.color}20`, color: jar.color }}
                                >
                                    <Icon size={24} strokeWidth={2.5} />
                                </div>
                                <p className="text-xs font-bold text-gray-500 mb-1">
                                    {jar.name} ({jar.allocation_percent}%)
                                </p>
                                <p className="text-sm font-extrabold text-gray-800">
                                    {jar.balance.toLocaleString()}đ
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-pink-50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-extrabold text-gray-700">Chi tiêu mới nhất</h3>
                    <button onClick={onViewHistory} className="text-xs font-bold text-[#FF7FA3] flex items-center">
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
        </motion.div>
    );
}
