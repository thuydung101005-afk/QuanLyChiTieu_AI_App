import React from 'react';
import { createPortal } from 'react-dom';
import { Settings, Plus, CheckCircle2, XCircle, Edit2, Trash2, Wallet, Home, Gamepad2, TrendingUp, BookOpen, PiggyBank, Heart, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiCreateJar, apiUpdateJar, apiDeleteJar, apiBulkUpdateJars, apiChangePassword, apiRequestEmailChange, apiVerifyEmailChange } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { ChickMascot } from './ChickMascot';
import { ConfirmDialog } from './ConfirmDialog';
import type { Jar, Transaction } from '../types';
import type { UserProfile } from '../hooks/useAuth';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
    'home': Home, 'gamepad': Gamepad2, 'trending-up': TrendingUp,
    'book-open': BookOpen, 'piggy-bank': PiggyBank, 'heart': Heart,
};

interface ProfileTabProps {
    userId: string;
    userProfile: UserProfile | null;
    jars: Jar[];
    transactions: Transaction[];
    onRefresh: () => Promise<void>;
    onTokenUpdate: (newToken: string, newUser: Partial<UserProfile>) => void;
    onLogout: () => void;
}

// ── OTP countdown hook ──────────────────────────────────────────────────────
function useCountdown(initial = 300) {
    const [secs, setSecs] = React.useState(initial);
    const ref = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const start = React.useCallback(() => {
        setSecs(initial);
        if (ref.current) clearInterval(ref.current);
        ref.current = setInterval(() => setSecs(s => { if (s <= 1) { clearInterval(ref.current!); return 0; } return s - 1; }), 1000);
    }, [initial]);
    React.useEffect(() => { start(); return () => { if (ref.current) clearInterval(ref.current); }; }, []);
    const fmt = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    return { secs, fmt, restart: start };
}

// ── OTP Input Component ──────────────────────────────────────────────────────
function OtpInputRow({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    const refs = React.useRef<(HTMLInputElement | null)[]>([]);
    const handleChange = (i: number, v: string) => {
        if (!/^\d*$/.test(v)) return;
        const next = [...value]; next[i] = v.slice(-1); onChange(next);
        if (v && i < 5) refs.current[i + 1]?.focus();
    };
    const handleKey = (i: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
    };
    const handlePaste = (e: React.ClipboardEvent) => {
        const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
        if (digits.length === 6) { onChange(digits); refs.current[5]?.focus(); }
        e.preventDefault();
    };
    return (
        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {value.map((d, i) => (
                <input key={i} ref={el => { refs.current[i] = el; }} value={d}
                    onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKey(i, e)}
                    maxLength={1} inputMode="numeric"
                    className="w-11 h-14 text-center text-xl font-extrabold border-2 rounded-2xl bg-gray-50 focus:outline-none focus:border-[#FF7FA3] focus:bg-white transition-all"
                    style={d ? { borderColor: '#FF7FA3', background: '#FFF0F5' } : {}} />
            ))}
        </div>
    );
}

// ── Change Email Modal (owns its own countdown) ─────────────────────────────
function ChangeEmailModal({ show, onClose, userProfile, onTokenUpdate, toast }: {
    show: boolean; onClose: () => void;
    userProfile: UserProfile | null;
    onTokenUpdate: (t: string, u: Partial<UserProfile>) => void;
    toast: any;
}) {
    const [step, setStep] = React.useState<'input' | 'otp'>('input');
    const [email, setEmail] = React.useState('');
    const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
    const [loading, setLoading] = React.useState(false);
    const { secs, fmt, restart } = useCountdown(300);

    React.useEffect(() => { if (!show) { setStep('input'); setEmail(''); setOtp(['','','','','','']); } }, [show]);

    const sendOtp = async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Email không hợp lệ'); return; }
        setLoading(true);
        try { await apiRequestEmailChange(email); setStep('otp'); restart(); toast.success('Mã OTP đã gửi!'); }
        catch (err: any) { toast.error(err.response?.data?.error || 'Lỗi gửi OTP'); }
        finally { setLoading(false); }
    };

    const verify = async () => {
        const code = otp.join('');
        if (code.length < 6) { toast.error('Nhập đủ 6 số'); return; }
        setLoading(true);
        try {
            const res = await apiVerifyEmailChange(email, code);
            onTokenUpdate(res.data.token, { email: email.toLowerCase().trim() });
            toast.success('Email đã được cập nhật!');
            onClose();
        } catch (err: any) { toast.error(err.response?.data?.error || 'OTP không đúng'); }
        finally { setLoading(false); }
    };

    if (!show) return null;
    return (
        <motion.div key="change-email-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex flex-col justify-end pointer-events-auto z-50 backdrop-blur-sm">
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl w-full">
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <p className="text-xs font-extrabold text-pink-400 uppercase tracking-widest mb-1">Tài khoản</p>
                        <h2 className="text-xl font-extrabold text-gray-800">{step === 'input' ? 'Đổi Email' : 'Xác Minh Email Mới'}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 bg-gray-100 w-10 h-10 flex items-center justify-center rounded-full"><XCircle size={20} /></button>
                </div>
                {step === 'input' ? (<>
                    <p className="text-sm text-gray-400 mb-4">Nhập email mới — chúng tôi sẽ gửi mã OTP xác minh.</p>
                    <div className="flex items-center gap-3 bg-gray-50 border-2 border-gray-100 focus-within:border-pink-200 focus-within:bg-white rounded-2xl px-4 py-3 mb-5 transition-all">
                        <Mail size={15} className="text-gray-400 shrink-0" />
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendOtp()}
                            placeholder="email.moi@gmail.com" className="flex-1 bg-transparent text-sm font-bold placeholder:text-gray-400 focus:outline-none" />
                    </div>
                    <button onClick={sendOtp} disabled={loading} className="w-full bg-[#FF7FA3] text-white font-extrabold py-4 rounded-2xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
                        {loading ? <><Loader2 size={16} className="animate-spin" /> Đang gửi...</> : <>Gửi Mã OTP <ArrowRight size={16} /></>}
                    </button>
                </>) : (<>
                    <p className="text-sm text-gray-400 mb-2 text-center">Nhập mã 6 số đã gửi về</p>
                    <p className="text-xs font-bold text-[#FF7FA3] text-center mb-4 px-3 py-1.5 bg-pink-50 rounded-full w-fit mx-auto">{email}</p>
                    <div className="mb-3"><OtpInputRow value={otp} onChange={setOtp} /></div>
                    <p className={`text-sm text-center font-bold mb-4 ${secs <= 60 ? 'text-red-400' : 'text-gray-400'}`}>
                        {secs > 0 ? <>⏱ Hết hạn sau <span className="font-extrabold">{fmt}</span></> : <span className="text-red-400">Mã đã hết hạn</span>}
                    </p>
                    <button onClick={verify} disabled={loading || otp.join('').length < 6}
                        className="w-full bg-[#FF7FA3] text-white font-extrabold py-4 rounded-2xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60 mb-3">
                        {loading ? <><Loader2 size={16} className="animate-spin" /> Đang xác nhận...</> : <><CheckCircle2 size={16} /> Xác Nhận</>}
                    </button>
                    <button onClick={async () => { if (secs > 240) return; await sendOtp(); restart(); setOtp(['','','','','','']); }}
                        disabled={secs > 240 || loading}
                        className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-gray-400 hover:text-pink-500 disabled:opacity-40">
                        <RefreshCw size={13} />{secs > 240 ? `Gửi lại sau ${secs - 240}s` : 'Gửi lại mã'}
                    </button>
                </>)}
            </motion.div>
        </motion.div>
    );
}

export function ProfileTab({ userId, userProfile, jars, transactions, onRefresh, onTokenUpdate, onLogout }: ProfileTabProps) {
    const toast = useToast();

    // ── Account Settings State ─────────────────────────────────────────────
    const [showChangePw, setShowChangePw] = React.useState(false);
    const [showChangeEmail, setShowChangeEmail] = React.useState(false);
    const [emailStep, setEmailStep] = React.useState<'input' | 'otp'>('input');
    const [newEmail, setNewEmail] = React.useState('');
    const [emailOtp, setEmailOtp] = React.useState(['', '', '', '', '', '']);
    // Change password fields
    const [oldPw, setOldPw] = React.useState('');
    const [newPw, setNewPw] = React.useState('');
    const [confirmPw, setConfirmPw] = React.useState('');
    const [showOldPw, setShowOldPw] = React.useState(false);
    const [showNewPw, setShowNewPw] = React.useState(false);
    const [showConfPw, setShowConfPw] = React.useState(false);
    const [settingsLoading, setSettingsLoading] = React.useState(false);
    const [pendingDeleteJarId, setPendingDeleteJarId] = React.useState<string | null>(null);
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

    const resetPwModal = () => { setOldPw(''); setNewPw(''); setConfirmPw(''); setShowOldPw(false); setShowNewPw(false); setShowConfPw(false); };
    const resetEmailModal = () => { setNewEmail(''); setEmailOtp(['', '', '', '', '', '']); setEmailStep('input'); };

    const handleChangePw = async () => {
        if (!oldPw || !newPw || !confirmPw) { toast.error('Vui lòng điền đầy đủ'); return; }
        if (newPw.length < 6) { toast.error('Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
        if (newPw !== confirmPw) { toast.error('Mật khẩu xác nhận không khớp'); return; }
        setSettingsLoading(true);
        try {
            await apiChangePassword(oldPw, newPw);
            toast.success('Mật khẩu đã được cập nhật!');
            setShowChangePw(false);
            resetPwModal();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Lỗi đổi mật khẩu');
        } finally { setSettingsLoading(false); }
    };

    const handleRequestEmailOtp = async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { toast.error('Email không hợp lệ'); return; }
        setSettingsLoading(true);
        try {
            await apiRequestEmailChange(newEmail);
            setEmailStep('otp');
            toast.success('Mã OTP đã gửi về email mới!');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Lỗi gửi OTP');
        } finally { setSettingsLoading(false); }
    };

    const handleVerifyEmailOtp = async () => {
        const code = emailOtp.join('');
        if (code.length < 6) { toast.error('Vui lòng nhập đủ 6 số'); return; }
        setSettingsLoading(true);
        try {
            const res = await apiVerifyEmailChange(newEmail, code);
            onTokenUpdate(res.data.token, { email: newEmail.toLowerCase().trim() });
            toast.success('Email đã được cập nhật thành công!');
            setShowChangeEmail(false);
            resetEmailModal();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Mã OTP không đúng hoặc đã hết hạn');
        } finally { setSettingsLoading(false); }
    };

    // ── Jar Management State (unchanged) ──────────────────────────────────
    const [isAddingJar, setIsAddingJar] = React.useState(false);
    const [isEditingBulk, setIsEditingBulk] = React.useState(false);
    const [newJarName, setNewJarName] = React.useState('');
    const [newJarAmount, setNewJarAmount] = React.useState('');
    const [newJarConcept, setNewJarConcept] = React.useState('GIAO_DICH_KHAC');
    const [newJarColor, setNewJarColor] = React.useState('#FFD1DA');
    const [newJarIcon, setNewJarIcon] = React.useState('gamepad');
    const [sourceJarId, setSourceJarId] = React.useState('');
    const [bulkUpdates, setBulkUpdates] = React.useState<{id: string, percent: number}[]>([]);

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

    const handleDeleteJar = (id: string) => {
        setPendingDeleteJarId(id);
    };

    const handleConfirmDeleteJar = async () => {
        if (!pendingDeleteJarId) return;
        try {
            await import('../services/api').then(m => m.apiDeleteJar(pendingDeleteJarId));
            await onRefresh();
            toast.success('Đã xoá hũ!');
        } catch { toast.error('Lỗi xoá hũ'); }
        setPendingDeleteJarId(null);
    };

    // ── Stats ──────────────────────────────────────────────────────────────
    const daysSinceJoined = userProfile?.created_at
        ? Math.max(1, Math.floor((Date.now() - new Date(userProfile.created_at).getTime()) / 86400000))
        : 0;
    const initials = (userProfile?.username || 'U').slice(0, 2).toUpperCase();
    const expenseCount = transactions.filter(t => t.type === 'expense').length;

    return (
        <>
            <motion.div key="profile" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col pb-6 pt-2 space-y-4">

            {/* ── Profile Header Card ── */}
            <div className="relative rounded-[28px] overflow-hidden shadow-md">
                <div className="h-20 bg-gradient-to-r from-[#FF7FA3] to-[#ffb3c6]" />
                <div className="bg-white px-5 pb-5">
                    <div className="flex items-end gap-4 -mt-10 mb-3">
                        <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-[#FF7FA3] to-[#ffd1da] flex items-center justify-center text-white text-2xl font-extrabold shadow-lg border-4 border-white shrink-0">
                            {initials}
                        </div>
                        <div className="pb-1 min-w-0">
                            <p className="text-lg font-extrabold text-gray-800 truncate">{userProfile?.username || '...'}</p>
                            <div className="flex items-center gap-1.5">
                                {userProfile?.email
                                    ? <p className="text-xs text-gray-400 font-medium truncate">{userProfile.email}</p>
                                    : <p className="text-xs text-orange-400 font-bold">Chưa có email</p>}
                                {userProfile?.is_verified
                                    ? <ShieldCheck size={13} className="text-green-500 shrink-0" />
                                    : userProfile?.email && <AlertCircle size={13} className="text-orange-400 shrink-0" />}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">🗓️ Tham gia {daysSinceJoined} ngày trước</p>
                </div>
            </div>

            {/* ── Quick Stats ── */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Giao dịch', value: transactions.length, emoji: '📊' },
                    { label: 'Hũ chi tiêu', value: jars.length, emoji: '🪙' },
                    { label: 'Ngày dùng', value: daysSinceJoined, emoji: '📅' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
                        <p className="text-xl mb-0.5">{s.emoji}</p>
                        <p className="text-lg font-extrabold text-gray-800">{s.value}</p>
                        <p className="text-[10px] text-gray-400 font-semibold">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Account Settings ── */}
            <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest px-5 pt-4 pb-2">Bảo mật & Tài khoản</p>
                <button onClick={() => { setShowChangePw(true); resetPwModal(); }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors border-t border-gray-50">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Lock size={16} className="text-blue-500" /></div>
                    <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-gray-800">Đổi Mật Khẩu</p>
                        <p className="text-xs text-gray-400">Cập nhật mật khẩu của bạn</p>
                    </div>
                    <ArrowRight size={16} className="text-gray-300" />
                </button>
                <button onClick={() => { setShowChangeEmail(true); resetEmailModal(); }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors border-t border-gray-100">
                    <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center shrink-0"><Mail size={16} className="text-pink-500" /></div>
                    <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-gray-800">Đổi Email</p>
                        <p className="text-xs text-gray-400">{userProfile?.email || 'Thêm email cho tài khoản'}</p>
                    </div>
                    <ArrowRight size={16} className="text-gray-300" />
                </button>
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
                <button onClick={() => setShowLogoutConfirm(true)} className="w-full bg-red-50 text-red-500 font-extrabold py-4 rounded-2xl shadow-sm border border-red-100 hover:bg-red-100 transition-colors">
                    Đăng Xuất
                </button>
            </div>

            {document.getElementById('app-modal-root') && createPortal(<>

                {/* Change Password Modal */}
                <AnimatePresence>
                    {showChangePw && (
                        <motion.div key="change-pw-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 flex flex-col justify-end pointer-events-auto z-50 backdrop-blur-sm">
                            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl flex flex-col w-full">
                                <div className="flex justify-between items-center mb-5">
                                    <div>
                                        <p className="text-xs font-extrabold text-blue-400 uppercase tracking-widest mb-1">Bảo mật</p>
                                        <h2 className="text-xl font-extrabold text-gray-800">Đổi Mật Khẩu</h2>
                                    </div>
                                    <button onClick={() => setShowChangePw(false)} className="text-gray-400 bg-gray-100 w-10 h-10 flex items-center justify-center rounded-full"><XCircle size={20} /></button>
                                </div>
                                <div className="space-y-3 mb-5">
                                    {[
                                        { label: 'Mật khẩu hiện tại', val: oldPw, set: setOldPw, show: showOldPw, toggle: () => setShowOldPw(v => !v) },
                                        { label: 'Mật khẩu mới', val: newPw, set: setNewPw, show: showNewPw, toggle: () => setShowNewPw(v => !v) },
                                        { label: 'Xác nhận mật khẩu mới', val: confirmPw, set: setConfirmPw, show: showConfPw, toggle: () => setShowConfPw(v => !v) },
                                    ].map(f => (
                                        <div key={f.label} className="flex items-center gap-3 bg-gray-50 border-2 border-gray-100 focus-within:border-blue-200 focus-within:bg-white rounded-2xl px-4 py-3 transition-all">
                                            <Lock size={15} className="text-gray-400 shrink-0" />
                                            <input type={f.show ? 'text' : 'password'} value={f.val} onChange={e => f.set(e.target.value)}
                                                placeholder={f.label} className="flex-1 bg-transparent text-sm font-bold placeholder:text-gray-400 focus:outline-none" />
                                            <button type="button" onClick={f.toggle} className="text-gray-400 hover:text-blue-500 transition-colors">
                                                {f.show ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleChangePw} disabled={settingsLoading}
                                    className="w-full bg-blue-500 text-white font-extrabold py-4 rounded-2xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
                                    {settingsLoading ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</> : <><CheckCircle2 size={16} /> Cập Nhật Mật Khẩu</>}
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* Change Email Modal — uses ChangeEmailModal component (hooks-safe) */}
                <AnimatePresence>
                    {showChangeEmail && (
                        <ChangeEmailModal
                            show={showChangeEmail}
                            onClose={() => setShowChangeEmail(false)}
                            userProfile={userProfile}
                            onTokenUpdate={onTokenUpdate}
                            toast={toast}
                        />
                    )}
                </AnimatePresence>


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

                <AnimatePresence>
                    {isAddingJar && (
                        <motion.div 
                            key="add-jar-modal"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 flex flex-col justify-end pointer-events-auto z-50 backdrop-blur-sm"
                        >
                            <motion.div 
                                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="bg-white rounded-t-[32px] p-6 pb-12 shadow-2xl h-[85vh] flex flex-col w-full relative"
                            >
                                <div className="flex justify-between items-center mb-0">
                                    <div>
                                        <p className="text-xs font-extrabold text-pink-500 uppercase tracking-widest mb-1">Tuỳ chỉnh</p>
                                        <h2 className="text-2xl font-extrabold text-gray-800">Tạo hũ mới</h2>
                                    </div>
                                    <button onClick={() => setIsAddingJar(false)} className="text-gray-400 bg-gray-100 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200">
                                        <XCircle size={20} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto no-scrollbar pt-4 pb-12">
                                    {/* Source Jar */}
                                    <div className="mb-4">
                                        <span className="text-sm font-bold text-gray-700 mb-2 block">💸 Trích tiền từ hũ:</span>
                                        <select value={sourceJarId} onChange={e => setSourceJarId(e.target.value)} className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-base font-bold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white border-2 border-transparent">
                                            {jars.map(j => (
                                                <option key={j.id} value={j.id}>{j.name} — {j.balance.toLocaleString()}đ</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Name + Amount */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div>
                                            <span className="text-sm font-bold text-gray-700 mb-2 block">🏷️ Tên Hũ:</span>
                                            <input type="text" value={newJarName} onChange={e => setNewJarName(e.target.value)} placeholder="Ví dụ: Du lịch..." className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white border-2 border-transparent" />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-gray-700 mb-2 block">💰 Số tiền (VNĐ):</span>
                                            <input type="number" placeholder="500000" value={newJarAmount} onChange={e => setNewJarAmount(e.target.value)} className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white border-2 border-transparent" />
                                        </div>
                                    </div>

                                    {/* Icon Picker */}
                                    <div className="mb-4">
                                        <span className="text-sm font-bold text-gray-700 mb-3 block">🎨 Chọn Icon:</span>
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
                                                    className={`flex flex-col items-center justify-center py-2.5 rounded-2xl text-xl transition-all border-2 ${newJarIcon === ic.key ? 'bg-pink-50 border-pink-400 scale-105 shadow-md' : 'bg-gray-50 border-transparent hover:border-pink-200'}`}
                                                    title={ic.label}
                                                >
                                                    {ic.emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Color Picker */}
                                    <div className="mb-5">
                                        <span className="text-sm font-bold text-gray-700 mb-3 block">🌈 Màu sắc:</span>
                                        <div className="flex gap-2.5 flex-wrap">
                                            {['#FF7FA3','#FFB347','#77DD77','#AEC6CF','#B39DDB','#F48FB1','#80DEEA','#FFCC02'].map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setNewJarColor(color)}
                                                    className={`w-10 h-10 rounded-full border-4 transition-all ${newJarColor === color ? 'border-gray-800 scale-110 shadow-md' : 'border-white shadow-sm hover:scale-105'}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* AI Group */}
                                    <div className="mb-8">
                                        <span className="text-sm font-bold text-gray-700 mb-2 block">🤖 Nhóm AI tự động:</span>
                                        <select value={newJarConcept} onChange={e => setNewJarConcept(e.target.value)} className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-base font-bold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white border-2 border-transparent">
                                            <option value="THIET_YEU">🏠 Thiết yếu</option>
                                            <option value="HUONG_THU">🎮 Hưởng thụ (Giải trí)</option>
                                            <option value="TICH_LUY">🐷 Tích luỹ</option>
                                            <option value="DAU_TU">📈 Đầu tư</option>
                                            <option value="GIAO_DUC">📖 Giáo dục</option>
                                            <option value="CHO_DI">❤️ Cho đi</option>
                                            <option value="GIAO_DICH_KHAC">✨ Khác</option>
                                        </select>
                                    </div>

                                    <button onClick={handleCreateJar} className="w-full bg-[#1A1A1A] text-white py-4 mt-2 rounded-[24px] font-extrabold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 transition-all text-lg">
                                        <CheckCircle2 size={20} /> Xác Nhận Tạo Hũ
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                </AnimatePresence>
</>,
                document.getElementById('app-modal-root')!
            )}

        </motion.div>

        {/* Confirm Delete Jar Dialog */}
        <ConfirmDialog
            open={!!pendingDeleteJarId}
            title="Xoá Hũ Phân Bổ?"
            message="Cậu chắc chắn muốn xoá hũ này? Các giao dịch bên trong cũng sẽ bị xoá!"
            confirmLabel="Xoá Hũ"
            cancelLabel="Huỷ"
            danger
            onConfirm={handleConfirmDeleteJar}
            onCancel={() => setPendingDeleteJarId(null)}
        />

        {/* Confirm Logout Dialog */}
        <ConfirmDialog
            open={showLogoutConfirm}
            title="Đăng Xuất?"
            message="Cậu có chắc chắn muốn đăng xuất không?"
            confirmLabel="Đăng Xuất"
            cancelLabel="Huỷ"
            danger
            onConfirm={() => {
                setShowLogoutConfirm(false);
                onLogout();
            }}
            onCancel={() => setShowLogoutConfirm(false)}
        />
        </>
    );
}
