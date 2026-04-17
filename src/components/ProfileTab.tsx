import React from 'react';
import { createPortal } from 'react-dom';
import { Settings, Plus, CheckCircle2, XCircle, Edit2, Trash2, Wallet, Home, Gamepad2, TrendingUp, BookOpen, PiggyBank, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiCreateJar, apiUpdateJar, apiDeleteJar, apiBulkUpdateJars } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { ChickMascot } from './ChickMascot';
import type { Jar } from '../types';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
    'home': Home, 'gamepad': Gamepad2, 'trending-up': TrendingUp,
    'book-open': BookOpen, 'piggy-bank': PiggyBank, 'heart': Heart,
};

interface ProfileTabProps {
    userId: string;
    jars: Jar[];
    onRefresh: () => Promise<void>;
    onLogout: () => void;
}

export function ProfileTab({ userId, jars, onRefresh, onLogout }: ProfileTabProps) {
    const toast = useToast();
    const [isAddingJar, setIsAddingJar] = React.useState(false);
    const [isEditingBulk, setIsEditingBulk] = React.useState(false);
    const [newJarName, setNewJarName] = React.useState('');
    const [newJarAmount, setNewJarAmount] = React.useState('');
    const [newJarConcept, setNewJarConcept] = React.useState('GIAO_DICH_KHAC');
    const [newJarColor, setNewJarColor] = React.useState('#FFD1DA');
    const [newJarIcon, setNewJarIcon] = React.useState('gamepad');
    const [sourceJarId, setSourceJarId] = React.useState('');
    const [bulkUpdates, setBulkUpdates] = React.useState<{id: string, percent: number}[]>([]);

    // Khi jars thay đổi (load xong), đảm bảo sourceJarId luôn hợp lệ
    React.useEffect(() => {
        if (jars.length > 0 && (!sourceJarId || !jars.find(j => j.id === sourceJarId))) {
            setSourceJarId(jars[0].id);
        }
    }, [jars]);
    const [editingJarId, setEditingJarId] = React.useState<string | null>(null);
    const [editJarName, setEditJarName] = React.useState('');
    const [editJarPercent, setEditJarPercent] = React.useState('');

    const totalPercent = jars.reduce((a, j) => a + j.allocation_percent, 0);

    const openBulkEditor = () => {
        setBulkUpdates(jars.map(j => ({ id: j.id, percent: j.allocation_percent })));
        setIsEditingBulk(true);
    };

    const handleSaveBulk = async () => {
        const bulkTotal = bulkUpdates.reduce((a, u) => a + u.percent, 0);
        if (bulkTotal !== 100) { toast.error('Tổng phân bổ phải đúng bằng 100%!'); return; }
        try {
            await apiBulkUpdateJars(bulkUpdates);
            setIsEditingBulk(false);
            await onRefresh();
            toast.success('Đã cập nhật phân bổ ngân sách!');
        } catch (err: any) { toast.error('Lỗi cập nhật: ' + err.message); }
    };

    const handleCreateJar = async () => {
        if (!newJarName || !sourceJarId) return;
        const splitAmt = parseFloat(newJarAmount);
        const sourceJar = jars.find(j => j.id === sourceJarId);

        if (!sourceJar) return;
        if (isNaN(splitAmt) || splitAmt <= 0) { toast.error('Hãy nhập số tiền trích hợp lệ!'); return; }
        if (splitAmt > sourceJar.balance) {
            toast.error(`Số tiền trích (${splitAmt.toLocaleString()}) lớn hơn số dư Hũ nguồn (${sourceJar.balance.toLocaleString()}).`);
            return;
        }

        try {
            const res = await apiCreateJar(newJarName, splitAmt, newJarConcept, sourceJarId, newJarColor, newJarIcon);
            setNewJarName('');
            setNewJarAmount('');
            setNewJarConcept('GIAO_DICH_KHAC');
            setIsAddingJar(false);
            const newPct = res.data?.newJarPercent || 0;
            toast.success(`Đã tạo hũ thành công! Hũ sẽ nhận ${newPct}% từ thu nhập tương lai.`);
            await onRefresh();
        } catch (err: any) {
            toast.error('Lỗi tạo hũ: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleUpdateJar = async () => {
        if (!editingJarId) return;
        const newPercent = parseInt(editJarPercent, 10);
        const currentJar = jars.find(j => j.id === editingJarId);
        const otherTotal = totalPercent - (currentJar?.allocation_percent || 0);
        if (otherTotal + newPercent > 100) {
            toast.error('Tổng % phân bổ sẽ vượt quá 100%!');
            return;
        }
        try {
            await apiUpdateJar(editingJarId, editJarName, newPercent);
            setEditingJarId(null);
            await onRefresh();
            toast.success('Đã cập nhật hũ thành công!');
        } catch { toast.error('Lỗi cập nhật hũ'); }
    };

    const handleDeleteJar = async (id: string) => {
        if (!window.confirm('Cậu chắc chắn muốn xoá hũ này? Các giao dịch bên trong cũng sẽ bị xoá!')) return;
        try {
            await import('../services/api').then(m => m.apiDeleteJar(id));
            await onRefresh();
            toast.success('Đã xoá hũ!');
        } catch { toast.error('Lỗi xoá hũ'); }
    };

    return (
        <motion.div
            key="profile"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col pb-6 pt-4 space-y-6"
        >
            <div className="flex flex-col items-center">
                <h2 className="text-2xl font-extrabold text-gray-800">Tài khoản của tôi</h2>
                <p className="text-sm font-bold text-gray-400 mb-6">
                    {jars.length} hũ chi tiêu · Tổng phân bổ:{' '}
                    <span className={totalPercent > 100 ? 'text-red-500' : totalPercent === 100 ? 'text-green-500' : 'text-orange-400'}>
                        {totalPercent}%
                    </span>
                </p>
            </div>

            {/* Jar Management */}
            <div className="space-y-4 flex-1">
                <button 
                  onClick={openBulkEditor} 
                  className="w-full flex items-center gap-4 bg-gradient-to-r from-orange-400 to-pink-500 text-white px-5 py-4 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all active:scale-95 text-left"
                >
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <Settings size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-sm leading-tight">Phân Phối Lại Ngân Sách</p>
                    <p className="text-white/75 text-xs font-medium mt-0.5">Kéo slider để điều chỉnh % các hũ</p>
                  </div>
                  <span className="text-white/80 text-lg">⚙️</span>
                </button>

                <div className="flex justify-between items-center mb-2 mt-4">
                    <h3 className="text-base font-extrabold text-gray-700 flex items-center gap-2">
                        Quản lý Hũ chi tiêu
                    </h3>
                    <button onClick={() => setIsAddingJar(!isAddingJar)} className="bg-pink-100 text-pink-500 p-1.5 rounded-lg hover:bg-pink-200">
                        <Plus size={16} strokeWidth={3} />
                    </button>
                </div>

                <AnimatePresence>
                    {isAddingJar && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-3xl p-5 border border-pink-100 mb-4 shadow-sm">
                                <p className="text-xs font-extrabold text-pink-400 uppercase tracking-widest mb-4">✨ Tạo Hũ Mới</p>

                                {/* Source Jar */}
                                <div className="mb-3">
                                    <span className="text-xs font-bold text-gray-500 mb-1 block">💸 Trích tiền từ hũ:</span>
                                    <select value={sourceJarId} onChange={e => setSourceJarId(e.target.value)} className="w-full bg-white px-3 py-2.5 rounded-xl text-sm font-bold ring-1 ring-pink-200 text-gray-700 shadow-sm">
                                        {jars.map(j => (
                                            <option key={j.id} value={j.id}>{j.name} — {j.balance.toLocaleString()}đ</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Name + Amount */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div>
                                        <span className="text-xs font-bold text-gray-500 mb-1 block">🏷️ Tên Hũ:</span>
                                        <input type="text" value={newJarName} onChange={e => setNewJarName(e.target.value)} placeholder="Ví dụ: Du lịch..." className="w-full bg-white px-3 py-2.5 rounded-xl text-sm font-bold ring-1 ring-pink-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-gray-500 mb-1 block">💰 Số tiền (VNĐ):</span>
                                        <input type="number" placeholder="500000" value={newJarAmount} onChange={e => setNewJarAmount(e.target.value)} className="w-full bg-white px-3 py-2.5 rounded-xl text-sm font-bold ring-1 ring-pink-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
                                    </div>
                                </div>

                                {/* Icon Picker */}
                                <div className="mb-3">
                                    <span className="text-xs font-bold text-gray-500 mb-2 block">🎨 Chọn Icon:</span>
                                    <div className="grid grid-cols-6 gap-2">
                                        {[
                                            { key: 'home', emoji: '🏠', label: 'Nhà' },
                                            { key: 'gamepad', emoji: '🎮', label: 'Vui' },
                                            { key: 'trending-up', emoji: '📈', label: 'Đầu tư' },
                                            { key: 'book-open', emoji: '📖', label: 'HT' },
                                            { key: 'piggy-bank', emoji: '🐷', label: 'TK' },
                                            { key: 'heart', emoji: '❤️', label: 'Cho đi' },
                                        ].map(ic => (
                                            <button
                                                key={ic.key}
                                                type="button"
                                                onClick={() => setNewJarIcon(ic.key)}
                                                className={`flex flex-col items-center justify-center py-2 rounded-xl text-lg transition-all border-2 ${newJarIcon === ic.key ? 'bg-pink-100 border-pink-400 scale-105 shadow-md' : 'bg-white border-transparent hover:border-pink-200'}`}
                                                title={ic.label}
                                            >
                                                {ic.emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Color Picker */}
                                <div className="mb-4">
                                    <span className="text-xs font-bold text-gray-500 mb-2 block">🌈 Màu sắc:</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {['#FF7FA3','#FFB347','#77DD77','#AEC6CF','#B39DDB','#F48FB1','#80DEEA','#FFCC02'].map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setNewJarColor(color)}
                                                className={`w-8 h-8 rounded-full border-4 transition-all ${newJarColor === color ? 'border-gray-600 scale-110 shadow-md' : 'border-white shadow-sm hover:scale-105'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* AI Group */}
                                <div className="mb-4">
                                    <span className="text-xs font-bold text-gray-500 mb-1 block">🤖 Nhóm AI tự động:</span>
                                    <select value={newJarConcept} onChange={e => setNewJarConcept(e.target.value)} className="w-full bg-white px-3 py-2.5 rounded-xl text-sm font-bold ring-1 ring-pink-200 text-gray-700 shadow-sm">
                                        <option value="THIET_YEU">🏠 Thiết yếu</option>
                                        <option value="HUONG_THU">🎮 Hưởng thụ (Giải trí)</option>
                                        <option value="TICH_LUY">🐷 Tích luỹ</option>
                                        <option value="DAU_TU">📈 Đầu tư</option>
                                        <option value="GIAO_DUC">📖 Giáo dục</option>
                                        <option value="CHO_DI">❤️ Cho đi</option>
                                        <option value="GIAO_DICH_KHAC">✨ Khác</option>
                                    </select>
                                </div>

                                <button onClick={handleCreateJar} className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-2xl font-extrabold flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-95 transition-all">
                                    <CheckCircle2 size={18} /> Tạo Hũ Mới ✨
                                </button>
                                <p className="text-[10px] text-gray-400 mt-2 font-medium text-center">Tiền sẽ được chuyển từ Hũ nguồn sang Hũ mới.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-3">
                    {jars.map(jar => (
                        <div key={jar.id} className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 flex justify-between items-center">
                            {editingJarId === jar.id ? (
                                <div className="flex-1 flex gap-2 items-center">
                                    <input type="text" value={editJarName} onChange={e => setEditJarName(e.target.value)} className="flex-1 bg-gray-50 px-2 py-1.5 rounded-lg text-sm font-bold" />
                                    <input type="number" value={editJarPercent} onChange={e => setEditJarPercent(e.target.value)} className="w-14 bg-gray-50 px-2 py-1.5 rounded-lg text-sm font-bold" />
                                    <span className="text-xs text-gray-400">%</span>
                                    <button onClick={handleUpdateJar} className="text-green-500 p-1"><CheckCircle2 size={18} /></button>
                                    <button onClick={() => setEditingJarId(null)} className="text-gray-400 p-1"><XCircle size={18} /></button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50" style={{ color: jar.color }}>
                                            {ICONS[jar.icon] ? React.createElement(ICONS[jar.icon], { size: 18 }) : <Wallet size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-extrabold text-gray-800">{jar.name}</p>
                                            <p className="text-xs font-bold text-gray-400">{jar.allocation_percent}% thu nhập</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingJarId(jar.id); setEditJarName(jar.name); setEditJarPercent(jar.allocation_percent.toString()); }} className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDeleteJar(jar.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Logout */}
            <div className="mt-8 pb-6">
                <button onClick={onLogout} className="w-full bg-red-50 text-red-500 font-extrabold py-4 rounded-2xl shadow-sm border border-red-100 hover:bg-red-100 transition-colors">
                    Đăng Xuất
                </button>
            </div>

            {document.getElementById('app-modal-root') && createPortal(
                <AnimatePresence>
                    {isEditingBulk && (
                        <motion.div 
                            key="bulk-editor"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 flex flex-col justify-end pointer-events-auto"
                        >
                            <motion.div 
                                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="bg-white rounded-t-[32px] p-6 pb-12 shadow-2xl h-[85vh] flex flex-col w-full"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-extrabold text-gray-800">Cấu Hình Ngân Sách</h2>
                                    <button onClick={() => setIsEditingBulk(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full hover:bg-gray-200">
                                        <XCircle size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                                    {bulkUpdates.map((bu, i) => {
                                        const jarInfo = jars.find(j => j.id === bu.id);
                                        if (!jarInfo) return null;
                                        return (
                                            <div key={bu.id} className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-bold text-gray-700">{jarInfo.name}</span>
                                                    <span className="text-sm font-extrabold text-pink-500">{bu.percent}%</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="100" value={bu.percent} 
                                                    onChange={e => {
                                                        const newArr = [...bulkUpdates];
                                                        newArr[i].percent = parseInt(e.target.value) || 0;
                                                        setBulkUpdates(newArr);
                                                    }}
                                                    className="w-full accent-pink-500 bg-pink-100 rounded-full appearance-none h-2"
                                                />
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-sm font-bold text-gray-500">Tổng phân bổ hiện tại:</span>
                                        <span className={`text-xl font-extrabold ${bulkUpdates.reduce((a, b) => a + b.percent, 0) === 100 ? 'text-green-500' : 'text-red-500'}`}>
                                            {bulkUpdates.reduce((a, b) => a + b.percent, 0)}/100%
                                        </span>
                                    </div>
                                    <button 
                                        onClick={handleSaveBulk}
                                        disabled={bulkUpdates.reduce((a, b) => a + b.percent, 0) !== 100}
                                        className="w-full py-4 rounded-xl font-extrabold text-white bg-gradient-to-r from-green-500 to-emerald-400 shadow-md transition-opacity disabled:opacity-50"
                                    >
                                        Cập Nhật Toàn Bộ
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.getElementById('app-modal-root')!
            )}

        </motion.div>
    );
}
