import React from 'react';
import { Settings, Plus, CheckCircle2, XCircle, Edit2, Trash2, Wallet, Home, Gamepad2, TrendingUp, BookOpen, PiggyBank, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiCreateJar, apiUpdateJar, apiDeleteJar } from '../services/api';
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
    const [isAddingJar, setIsAddingJar] = React.useState(false);
    const [newJarName, setNewJarName] = React.useState('');
    const [newJarPercent, setNewJarPercent] = React.useState('5');
    const [newJarConcept, setNewJarConcept] = React.useState('GIAO_DICH_KHAC');
    const [sourceJarId, setSourceJarId] = React.useState('');

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

    const handleCreateJar = async () => {
        if (!newJarName || !sourceJarId) return;
        const newPercent = parseInt(newJarPercent, 10);
        const sourceJar = jars.find(j => j.id === sourceJarId);

        if (!sourceJar) return;
        if (newPercent >= sourceJar.allocation_percent) {
            alert(`Lỗi! Phần trăm trích xuất (${newPercent}%) phải NHỎ HƠN phần trăm hiện tại của Hũ nguồn (${sourceJar.allocation_percent}%).`);
            return;
        }

        // if (!window.confirm(`Bạn sẽ trích ${newPercent}% (và số dư tương ứng) từ hũ "${sourceJar.name}" sang hũ mới "${newJarName}". Xác nhận?`)) return;

        try {
            await apiCreateJar(userId, newJarName, newPercent, newJarConcept, sourceJarId);
            setNewJarName('');
            setNewJarPercent('5');
            setNewJarConcept('GIAO_DICH_KHAC');
            setIsAddingJar(false);
            await onRefresh();
        } catch (err: any) {
            alert('Lỗi tạo hũ: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleUpdateJar = async () => {
        if (!editingJarId) return;
        const newPercent = parseInt(editJarPercent, 10);
        const currentJar = jars.find(j => j.id === editingJarId);
        const otherTotal = totalPercent - (currentJar?.allocation_percent || 0);
        if (otherTotal + newPercent > 100) {
            alert(`Tổng % phân bổ sẽ vượt quá 100%!`);
            return;
        }
        try {
            await apiUpdateJar(editingJarId, userId, editJarName, newPercent);
            setEditingJarId(null);
            await onRefresh();
        } catch { alert('Lỗi cập nhật hũ'); }
    };

    const handleDeleteJar = async (id: string) => {
        if (!window.confirm('Cậu chắc chắn muốn xoá hũ này? Các giao dịch bên trong cũng sẽ bị xoá!')) return;
        try {
            await apiDeleteJar(id, userId);
            await onRefresh();
        } catch { alert('Lỗi xoá hũ'); }
    };

    return (
        <motion.div
            key="profile"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col h-full absolute inset-0 bg-white z-20 pb-28 overflow-y-auto"
        >
            {/* Header */}
            <div className="h-40 bg-[#FFD1DA] rounded-b-[40px] flex flex-col items-center justify-end pb-6 shrink-0">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-white shadow-md -mb-10 z-10">
                    <span className="text-3xl">🥚</span>
                </div>
            </div>

            <div className="mt-14 px-6 flex flex-col items-center">
                <h2 className="text-2xl font-extrabold text-gray-800">Tài khoản của tôi</h2>
                <p className="text-sm font-bold text-gray-400 mb-6">
                    {jars.length} hũ chi tiêu · Tổng phân bổ:{' '}
                    <span className={totalPercent > 100 ? 'text-red-500' : totalPercent === 100 ? 'text-green-500' : 'text-orange-400'}>
                        {totalPercent}%
                    </span>
                </p>
            </div>

            {/* Jar Management */}
            <div className="px-6 space-y-4 flex-1">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-base font-extrabold text-gray-700 flex items-center gap-2">
                        <Settings size={18} className="text-pink-400" /> Quản lý Hũ chi tiêu
                    </h3>
                    <button onClick={() => setIsAddingJar(!isAddingJar)} className="bg-pink-100 text-pink-500 p-1.5 rounded-lg hover:bg-pink-200">
                        <Plus size={16} strokeWidth={3} />
                    </button>
                </div>

                <AnimatePresence>
                    {isAddingJar && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="bg-pink-50 rounded-2xl p-4 border border-pink-100 mb-4">

                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-gray-500">Lấy % từ hũ:</span>
                                        <select value={sourceJarId} onChange={e => setSourceJarId(e.target.value)} className="w-full bg-white px-3 py-2 rounded-xl text-sm font-bold ring-1 ring-pink-200 text-gray-700">
                                            {jars.map(j => (
                                                <option key={j.id} value={j.id}>{j.name} (Đang có {j.allocation_percent}%)</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <span className="text-xs font-bold text-gray-500">Tên Hũ mới:</span>
                                            <input type="text" value={newJarName} onChange={e => setNewJarName(e.target.value)} placeholder="Tên hũ con..." className="w-full bg-white px-3 py-2 rounded-xl text-sm font-bold ring-1 ring-pink-200" />
                                        </div>
                                        <div className="w-24 flex flex-col gap-1">
                                            <span className="text-xs font-bold text-gray-500">% Cắt ra:</span>
                                            <div className="flex gap-1 items-center">
                                                <input type="number" title="% Trích ra" value={newJarPercent} onChange={e => setNewJarPercent(e.target.value)} min={1} max={99} className="w-full bg-white px-3 py-2 rounded-xl text-sm font-bold ring-1 ring-pink-200" />
                                                <span className="text-xs font-bold text-pink-400">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <span className="text-xs font-bold text-gray-500">Nhóm Concept AI:</span>
                                            <select value={newJarConcept} onChange={e => setNewJarConcept(e.target.value)} className="w-full bg-white px-3 py-2 rounded-xl text-sm font-bold ring-1 ring-pink-200 text-gray-700">
                                                <option value="THIET_YEU">Thiết yếu</option>
                                                <option value="HUONG_THU">Hưởng thụ (Giải trí)</option>
                                                <option value="TICH_LUY">Tích luỹ</option>
                                                <option value="DAU_TU">Đầu tư</option>
                                                <option value="GIAO_DUC">Giáo dục</option>
                                                <option value="CHO_DI">Cho đi</option>
                                                <option value="GIAO_DICH_KHAC">Khác</option>
                                            </select>
                                        </div>
                                        <button onClick={handleCreateJar} className="bg-pink-500 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-1 font-bold h-[36px]">
                                            <CheckCircle2 size={16} /> Lưu
                                        </button>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-400 mt-3 font-medium text-center">Tiền trong Hũ nguồn cũng sẽ được chia bớt sang Hũ mới.</p>
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
            <div className="mt-8 px-6 pb-6">
                <button onClick={onLogout} className="w-full bg-red-50 text-red-500 font-extrabold py-4 rounded-2xl shadow-sm border border-red-100 hover:bg-red-100 transition-colors">
                    Đăng Xuất
                </button>
            </div>
        </motion.div>
    );
}
