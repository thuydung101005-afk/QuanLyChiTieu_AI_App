import React, { useState } from 'react';
import { Send, Sparkles, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiPredictTransaction, apiConfirmTransaction, apiAddIncome } from '../services/api';
import type { Jar, PendingTx, TxType } from '../types';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface MagicInputBarProps {
    userId: string;
    jars: Jar[];
    onSuccess: () => Promise<void>;
    onClose: () => void;
}

export function MagicInputBar({ userId, jars, onSuccess, onClose }: MagicInputBarProps) {
    const [txType, setTxType] = useState<TxType>('expense');
    const [rawInput, setRawInput] = useState('');
    const [incomeAmount, setIncomeAmount] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [pendingTx, setPendingTx] = useState<PendingTx | null>(null);
    const [selectedJarId, setSelectedJarId] = useState<string | null>(null);
    const [showJarSelector, setShowJarSelector] = useState(false);

    const handlePredict = async () => {
        if (!rawInput.trim() || isAdding) return;
        setIsAdding(true);
        try {
            const res = await apiPredictTransaction(rawInput, userId);
            const prediction = res.data.brain_1_result;
            setPendingTx(prediction);
            setSelectedJarId(prediction.predicted_jar_id);
        } catch (err: any) {
            const serverMsg = err.response?.data?.error || err.message || '';
            if (!err.response || serverMsg.includes('microservice') || serverMsg.includes('ECONNREFUSED')) {
                alert('⚠️ Dịch vụ AI (Python) chưa được khởi động!\n\nHãy chạy lệnh sau trong terminal:\n  python ai_service.py');
            } else {
                alert('Lỗi AI: ' + serverMsg);
            }
        } finally {
            setIsAdding(false);
        }
    };


    const handleConfirm = async () => {
        if (!pendingTx || isAdding || !selectedJarId) return;
        setIsAdding(true);
        try {
            await apiConfirmTransaction(pendingTx, selectedJarId, userId);
            await onSuccess();
            onClose();
        } catch (err: any) {
            alert('Lỗi lưu giao dịch: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsAdding(false);
        }
    };

    const handleAddIncome = async () => {
        if (!incomeAmount || isAdding) return;
        setIsAdding(true);
        try {
            await apiAddIncome(userId, parseFloat(incomeAmount), rawInput || 'Nạp tiền ngân sách');
            await onSuccess();
            onClose();
        } catch (err: any) {
            alert('Lỗi nạp tiền: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsAdding(false);
        }
    };

    const Spinner = () => <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => !isAdding && onClose()}
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full bg-[#f8fafc] rounded-t-[32px] p-6 pb-10 shadow-[0_-20px_40px_rgba(0,0,0,0.15)] flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-2" />

                {/* Type Toggle */}
                {!pendingTx && (
                    <div className="flex bg-gray-100 rounded-xl p-1 w-full mb-2">
                        <button
                            onClick={() => setTxType('expense')}
                            className={cn('flex-1 py-2 rounded-lg text-sm font-bold transition-all', txType === 'expense' ? 'bg-white text-pink-500 shadow-sm' : 'text-gray-500')}
                        >Chi Tiêu</button>
                        <button
                            onClick={() => setTxType('income')}
                            className={cn('flex-1 py-2 rounded-lg text-sm font-bold transition-all', txType === 'income' ? 'bg-white text-green-500 shadow-sm' : 'text-gray-500')}
                        >Thu Nhập / Nạp Ngân Sách</button>
                    </div>
                )}

                {/* Expense Input */}
                {!pendingTx && txType === 'expense' && (
                    <div className="relative mt-2">
                        <input
                            type="text" value={rawInput} onChange={e => setRawInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePredict()}
                            placeholder="Gõ: Cà phê sữa 35k" autoFocus disabled={isAdding}
                            className="w-full bg-white border border-gray-200 shadow-sm rounded-2xl pl-5 pr-14 py-4 text-base font-bold placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
                        />
                        <button
                            onClick={handlePredict} disabled={isAdding || !rawInput.trim()}
                            className="absolute right-2 top-2 bottom-2 aspect-square bg-pink-500 text-white rounded-xl flex items-center justify-center disabled:opacity-50 transition-transform active:scale-95"
                        >
                            {isAdding ? <Spinner /> : <Send size={18} className="translate-x-[1px]" strokeWidth={2.5} />}
                        </button>
                    </div>
                )}

                {/* Income Input */}
                {!pendingTx && txType === 'income' && (
                    <div className="space-y-3 mt-2">
                        <input type="number" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="Số tiền: 10000000" autoFocus
                            className="w-full bg-white border border-gray-200 shadow-sm rounded-2xl px-5 py-4 text-base font-bold focus:ring-4 focus:ring-green-100 focus:border-green-300 transition-all" />
                        <input type="text" value={rawInput} onChange={e => setRawInput(e.target.value)} placeholder="Mô tả (tuỳ chọn): Lương tháng 10"
                            className="w-full bg-white border border-gray-200 shadow-sm rounded-2xl px-5 py-4 text-base font-bold focus:ring-4 focus:ring-green-100 transition-all" />
                        <button onClick={handleAddIncome} disabled={!incomeAmount || isAdding}
                            className="w-full mt-2 py-4 rounded-xl font-extrabold text-white bg-gradient-to-r from-green-500 to-emerald-400 hover:opacity-90 shadow-md flex justify-center items-center disabled:opacity-60">
                            {isAdding ? <Spinner /> : 'Phân bổ tự động vào các hũ ✨'}
                        </button>
                    </div>
                )}

                {/* Confirmation Bubble */}
                {pendingTx && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[24px] p-5 border-2 border-[#FFD1DA] shadow-lg flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] bg-[#FFF4DC] border border-yellow-200 flex items-center justify-center shrink-0 mt-1">
                                <Sparkles size={16} className="text-orange-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[13px] font-bold text-[#FF7FA3] mb-1">Đã hiểu nha!</p>
                                <div className="text-base text-gray-800 font-bold flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span>{pendingTx.extracted_name}</span>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-[#FF7FA3]">{pendingTx.extracted_amount.toLocaleString()}đ</span>
                                    <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                                        {Math.round(pendingTx.confidence_score * 100)}% chắc
                                    </span>
                                </div>
                                <div className="mt-3 flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-gray-500">Cho vào:</span>
                                    <button onClick={() => setShowJarSelector(!showJarSelector)}
                                        className="bg-pink-50 border border-pink-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-pink-100 transition-colors">
                                        <span className="text-sm font-extrabold text-[#FF7FA3]">
                                            {jars.find(j => j.id === selectedJarId)?.name || 'Hũ tuỳ chỉnh'}
                                        </span>
                                        <ChevronDown size={14} className="text-pink-400" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {showJarSelector && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-gray-100">
                                        {jars.map(jar => (
                                            <button key={jar.id} onClick={() => { setSelectedJarId(jar.id); setShowJarSelector(false); }}
                                                className={cn('text-left px-3 py-2 rounded-xl text-xs font-bold transition-all border',
                                                    selectedJarId === jar.id
                                                        ? 'bg-[#FF7FA3] text-white border-[#FF7FA3] shadow-[0_4px_10px_rgba(255,127,163,0.3)]'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'
                                                )}>
                                                {jar.name}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-3 mt-2">
                            <button onClick={() => setPendingTx(null)} className="flex-1 py-3.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                                Nhập lại
                            </button>
                            <button onClick={handleConfirm} disabled={isAdding}
                                className="flex-[2] py-3.5 rounded-xl font-extrabold text-white bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-90 transition-all shadow-md active:scale-95 flex justify-center items-center">
                                {isAdding ? <Spinner /> : 'Xác nhận lưu ✓'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
}
