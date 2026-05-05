import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, User, Lock, Mail, ArrowRight, Loader2, CheckCircle, ArrowLeft, RefreshCw, KeyRound } from 'lucide-react';
import { ChickMascot } from './ChickMascot';
import type { AuthMode } from '../types';
import type { AuthStep } from '../hooks/useAuth';

interface AuthScreenProps {
    authMode: AuthMode; setAuthMode: (m: AuthMode) => void;
    authStep: AuthStep;
    authUsername: string; setAuthUsername: (v: string) => void;
    authPassword: string; setAuthPassword: (v: string) => void;
    authEmail: string; setAuthEmail: (v: string) => void;
    authError: string;
    pendingEmail: string;
    handleAuth: () => Promise<void>;
    handleVerifyOtp: (otp: string) => Promise<void>;
    handleResendOtp: (type?: 'verify' | 'reset') => Promise<void>;
    handleForgotSendOtp: (email: string) => Promise<void>;
    handleForgotVerifyOtp: (otp: string) => Promise<void>;
    handleForgotReset: (newPassword: string) => Promise<void>;
    goToForgotPassword: () => void;
    goBackToForm: () => void;
}

// ── OTP Countdown Hook ──────────────────────────────────────────────────────
function useCountdown(initial = 300) {
    const [secs, setSecs] = useState(initial);
    const ref = useRef<ReturnType<typeof setInterval> | null>(null);
    const start = () => {
        setSecs(initial);
        if (ref.current) clearInterval(ref.current);
        ref.current = setInterval(() => setSecs(s => { if (s <= 1) { clearInterval(ref.current!); return 0; } return s - 1; }), 1000);
    };
    useEffect(() => { start(); return () => { if (ref.current) clearInterval(ref.current); }; }, []);
    const fmt = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    return { secs, fmt, restart: start };
}

// ── Shared Input ─────────────────────────────────────────────────────────────
function Input({ icon: Icon, error, right, ...props }: any) {
    return (
        <div>
            <div className={`flex items-center gap-3 w-full bg-gray-50 border-2 rounded-2xl px-4 py-3.5 transition-all ${error ? 'border-red-300 bg-red-50' : 'border-gray-100 focus-within:border-pink-200 focus-within:bg-white'}`}>
                <Icon size={16} className={error ? 'text-red-400' : 'text-gray-400'} />
                <input className="flex-1 bg-transparent text-sm font-bold placeholder:text-gray-400 focus:outline-none" {...props} />
                {right}
            </div>
            <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs text-red-400 font-medium mt-1 ml-2">{error}</motion.p>}
            </AnimatePresence>
        </div>
    );
}

// ── Submit Button ────────────────────────────────────────────────────────────
function SubmitBtn({ loading, label, loadingLabel, disabled }: { loading: boolean; label: string; loadingLabel: string; disabled?: boolean }) {
    return (
        <motion.button type="submit" disabled={loading || disabled} whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02, y: -2 }}
            className="w-full bg-[#FF7FA3] text-white font-extrabold py-4 rounded-2xl shadow-[0_8px_20px_rgba(255,127,163,0.35)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-1">
            {loading ? <><Loader2 size={18} className="animate-spin" /><span>{loadingLabel}</span></> : <><span>{label}</span><ArrowRight size={16} /></>}
        </motion.button>
    );
}

// ── Error/Success Banner ─────────────────────────────────────────────────────
function Banner({ msg }: { msg: string }) {
    if (!msg) return null;
    const ok = msg.startsWith('✅');
    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: 16 }} exit={{ opacity: 0, height: 0 }}
                className={`w-full rounded-2xl px-4 py-3 text-xs font-bold text-center flex items-center justify-center gap-2 ${ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                {ok && <CheckCircle size={14} className="shrink-0" />}{msg}
            </motion.div>
        </AnimatePresence>
    );
}

// ── OTP Input Screen ─────────────────────────────────────────────────────────
function OtpScreen({ title, subtitle, pendingEmail, onVerify, onResend, onBack, error, otpType }:
    { title: string; subtitle: string; pendingEmail: string; onVerify: (o: string) => Promise<void>; onResend: () => Promise<void>; onBack: () => void; error: string; otpType: 'verify' | 'reset' }) {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const refs = useRef<(HTMLInputElement | null)[]>([]);
    const { secs, fmt, restart } = useCountdown(300);

    const handleChange = (i: number, v: string) => {
        if (!/^\d*$/.test(v)) return;
        const next = [...otp]; next[i] = v.slice(-1); setOtp(next);
        if (v && i < 5) refs.current[i + 1]?.focus();
    };
    const handleKey = (i: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
    };
    const handlePaste = (e: React.ClipboardEvent) => {
        const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
        if (digits.length === 6) { setOtp(digits); refs.current[5]?.focus(); }
        e.preventDefault();
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) return;
        setLoading(true);
        try { await onVerify(code); } catch { } finally { setLoading(false); }
    };

    const resend = async () => {
        setResending(true);
        try { await onResend(); restart(); setOtp(['', '', '', '', '', '']); refs.current[0]?.focus(); } catch { } finally { setResending(false); }
    };

    return (
        <form onSubmit={submit} className="w-full flex flex-col items-center">
            <ChickMascot size={0.6} />
            <h1 className="text-2xl font-extrabold text-[#FF7FA3] mb-1">{title}</h1>
            <p className="text-sm text-gray-400 font-medium mb-2 text-center">{subtitle}</p>
            <p className="text-xs font-bold text-[#FF7FA3] mb-6 px-4 py-2 bg-pink-50 rounded-full">{pendingEmail}</p>
            <Banner msg={error} />
            {/* OTP boxes */}
            <div className="flex gap-2 mb-4" onPaste={handlePaste}>
                {otp.map((d, i) => (
                    <input key={i} ref={el => { refs.current[i] = el; }} value={d} onChange={e => handleChange(i, e.target.value)}
                        onKeyDown={e => handleKey(i, e)} maxLength={1} inputMode="numeric"
                        className="w-11 h-14 text-center text-xl font-extrabold border-2 rounded-2xl bg-gray-50 focus:outline-none focus:border-[#FF7FA3] focus:bg-white transition-all"
                        style={d ? { borderColor: '#FF7FA3', background: '#FFF0F5' } : {}} />
                ))}
            </div>
            {/* Countdown */}
            <div className={`text-sm font-bold mb-5 ${secs <= 60 ? 'text-red-400' : 'text-gray-400'}`}>
                {secs > 0 ? <>⏱ Mã hết hạn sau <span className="font-extrabold">{fmt}</span></> : <span className="text-red-400">Mã đã hết hạn</span>}
            </div>
            <SubmitBtn loading={loading} label="Xác nhận" loadingLabel="Đang xác nhận..." disabled={otp.join('').length < 6} />
            <button type="button" onClick={resend} disabled={resending || secs > 240}
                className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-gray-400 hover:text-[#FF7FA3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                {resending ? 'Đang gửi lại...' : secs > 240 ? `Gửi lại sau ${secs - 240}s` : 'Gửi lại mã'}
            </button>
            <button type="button" onClick={onBack} className="flex items-center gap-1 mt-2 text-xs font-semibold text-gray-300 hover:text-gray-500 transition-colors">
                <ArrowLeft size={13} />Quay lại
            </button>
        </form>
    );
}

// ── Main AuthScreen ──────────────────────────────────────────────────────────
export function AuthScreen({
    authMode, setAuthMode, authStep,
    authUsername, setAuthUsername, authPassword, setAuthPassword, authEmail, setAuthEmail,
    authError, pendingEmail,
    handleAuth, handleVerifyOtp, handleResendOtp,
    handleForgotSendOtp, handleForgotVerifyOtp, handleForgotReset,
    goToForgotPassword, goBackToForm,
}: AuthScreenProps) {
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [mood, setMood] = useState<'idle' | 'happy' | 'sad' | 'thinking'>('idle');
    const [errs, setErrs] = useState<Record<string, string>>({});
    // Forgot email state
    const [forgotEmail, setForgotEmail] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmNewPw, setConfirmNewPw] = useState('');

    useEffect(() => {
        if (authError) { setMood(authError.startsWith('✅') ? 'happy' : 'sad'); const t = setTimeout(() => setMood('idle'), 3000); return () => clearTimeout(t); }
    }, [authError]);

    useEffect(() => { setConfirm(''); setErrs({}); setShowPw(false); setShowConfirm(false); }, [authMode]);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!authUsername.trim()) e.username = 'Vui lòng nhập tên tài khoản';
        else if (authUsername.trim().length < 3) e.username = 'Tối thiểu 3 ký tự';
        if (!authPassword) e.password = 'Vui lòng nhập mật khẩu';
        else if (authMode === 'signup' && authPassword.length < 6) e.password = 'Tối thiểu 6 ký tự';
        if (authMode === 'signup') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) e.email = 'Email không hợp lệ';
            if (authPassword !== confirm) e.confirm = 'Mật khẩu xác nhận không khớp';
        }
        setErrs(e); return Object.keys(e).length === 0;
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) { setMood('sad'); setTimeout(() => setMood('idle'), 2000); return; }
        setLoading(true); setMood('thinking');
        try { await handleAuth(); } catch { setMood('sad'); setTimeout(() => setMood('idle'), 2500); } finally { setLoading(false); if (mood === 'thinking') setMood('idle'); }
    };

    const forgotSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) { setErrs({ fEmail: 'Email không hợp lệ' }); return; }
        setLoading(true); setMood('thinking');
        try { await handleForgotSendOtp(forgotEmail); setMood('happy'); } catch { setMood('sad'); } finally { setLoading(false); }
    };

    const forgotReset = async (e: React.FormEvent) => {
        e.preventDefault();
        const e2: Record<string, string> = {};
        if (newPw.length < 6) e2.newPw = 'Tối thiểu 6 ký tự';
        if (newPw !== confirmNewPw) e2.confirmNewPw = 'Mật khẩu không khớp';
        if (Object.keys(e2).length) { setErrs(e2); return; }
        setLoading(true); setMood('thinking');
        try { await handleForgotReset(newPw); setMood('happy'); } catch { setMood('sad'); } finally { setLoading(false); }
    };

    const eyeBtn = (show: boolean, toggle: () => void) => (
        <button type="button" onClick={toggle} tabIndex={-1} className="text-gray-400 hover:text-[#FF7FA3] transition-colors p-0.5">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
    );

    const card = (content: React.ReactNode) => (
        <div className="min-h-screen bg-gradient-to-br from-[#FFF0F5] via-[#FCFAFA] to-[#FFF0E0] flex justify-center items-center p-4 font-sans">
            <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4 }}
                className="w-full max-w-[400px] bg-white rounded-[40px] px-8 pt-8 pb-7 shadow-2xl border-[6px] border-[#FFE5E5] flex flex-col items-center">
                {content}
            </motion.div>
        </div>
    );

    // ── Verify OTP (signup) ──────────────────────────────────────────────────
    if (authStep === 'verify-otp') {
        return card(
            <OtpScreen title="Xác minh Email" subtitle="Nhập mã 6 số đã gửi về"
                pendingEmail={pendingEmail} error={authError} otpType="verify"
                onVerify={async (otp) => { await handleVerifyOtp(otp); }}
                onResend={() => handleResendOtp('verify')}
                onBack={goBackToForm} />
        );
    }

    // ── Forgot: Enter email ──────────────────────────────────────────────────
    if (authStep === 'forgot-email') {
        return card(<>
            <ChickMascot size={0.6} />
            <h1 className="text-2xl font-extrabold text-[#FF7FA3] mb-1">Quên Mật Khẩu</h1>
            <p className="text-sm text-gray-400 font-medium mb-6 text-center">Nhập email để nhận mã xác nhận</p>
            <Banner msg={authError} />
            <form onSubmit={forgotSend} className="w-full space-y-3">
                <Input icon={Mail} type="email" value={forgotEmail} onChange={(e: any) => { setForgotEmail(e.target.value); setErrs({}); }}
                    placeholder="Email của bạn" error={errs.fEmail} disabled={loading} />
                <SubmitBtn loading={loading} label="Gửi mã OTP" loadingLabel="Đang gửi..." />
                <button type="button" onClick={goBackToForm}
                    className="flex items-center justify-center gap-1 w-full mt-1 text-xs font-semibold text-gray-300 hover:text-gray-500 transition-colors">
                    <ArrowLeft size={13} />Quay lại đăng nhập
                </button>
            </form>
        </>);
    }

    // ── Forgot: Enter OTP ────────────────────────────────────────────────────
    if (authStep === 'forgot-otp') {
        return card(
            <OtpScreen title="Xác nhận OTP" subtitle="Nhập mã đã gửi về email của bạn"
                pendingEmail={pendingEmail} error={authError} otpType="reset"
                onVerify={async (otp) => { await handleForgotVerifyOtp(otp); }}
                onResend={() => handleResendOtp('reset')}
                onBack={() => { goBackToForm(); }} />
        );
    }

    // ── Forgot: Set new password ─────────────────────────────────────────────
    if (authStep === 'forgot-reset') {
        return card(<>
            <ChickMascot size={0.6} />
            <KeyRound size={20} className="text-[#FF7FA3] -mt-2 mb-2" />
            <h1 className="text-2xl font-extrabold text-[#FF7FA3] mb-1">Đặt Mật Khẩu Mới</h1>
            <p className="text-sm text-gray-400 font-medium mb-6">Nhập mật khẩu mới cho tài khoản</p>
            <Banner msg={authError} />
            <form onSubmit={forgotReset} className="w-full space-y-3">
                <Input icon={Lock} type={showNewPw ? 'text' : 'password'} value={newPw}
                    onChange={(e: any) => { setNewPw(e.target.value); setErrs(p => ({ ...p, newPw: '' })); }}
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" error={errs.newPw} disabled={loading}
                    right={eyeBtn(showNewPw, () => setShowNewPw(v => !v))} />
                <Input icon={Lock} type={showConfirm ? 'text' : 'password'} value={confirmNewPw}
                    onChange={(e: any) => { setConfirmNewPw(e.target.value); setErrs(p => ({ ...p, confirmNewPw: '' })); }}
                    placeholder="Xác nhận mật khẩu mới" error={errs.confirmNewPw} disabled={loading}
                    right={eyeBtn(showConfirm, () => setShowConfirm(v => !v))} />
                <SubmitBtn loading={loading} label="Đổi Mật Khẩu" loadingLabel="Đang lưu..." />
            </form>
        </>);
    }

    // ── Default: Login / Signup form ─────────────────────────────────────────
    const isSignup = authMode === 'signup';
    return card(<>
        <ChickMascot size={0.6} />
        <AnimatePresence mode="wait">
            <motion.h1 key={authMode} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}
                className="text-3xl font-extrabold text-[#FF7FA3] mb-1">
                {isSignup ? 'Đăng Ký' : 'Đăng Nhập'}
            </motion.h1>
        </AnimatePresence>
        <p className="text-sm text-gray-400 font-medium mb-6">{isSignup ? 'Tạo tài khoản để bắt đầu!' : 'Bé Trứng đợi bạn nãy giờ nè!'}</p>
        <Banner msg={authError} />
        <form onSubmit={submit} className="w-full space-y-3">
            <Input icon={User} type="text" value={authUsername} onChange={(e: any) => { setAuthUsername(e.target.value); setErrs(p => ({ ...p, username: '' })); }}
                placeholder="Tên tài khoản" autoComplete="username" disabled={loading} error={errs.username} />
            <AnimatePresence>
                {isSignup && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                        <Input icon={Mail} type="email" value={authEmail} onChange={(e: any) => { setAuthEmail(e.target.value); setErrs(p => ({ ...p, email: '' })); }}
                            placeholder="Email của bạn" autoComplete="email" disabled={loading} error={errs.email} />
                    </motion.div>
                )}
            </AnimatePresence>
            <Input icon={Lock} type={showPw ? 'text' : 'password'} value={authPassword}
                onChange={(e: any) => { setAuthPassword(e.target.value); setErrs(p => ({ ...p, password: '' })); }}
                placeholder="Mật khẩu" autoComplete={isSignup ? 'new-password' : 'current-password'} disabled={loading}
                error={errs.password} right={eyeBtn(showPw, () => setShowPw(v => !v))} />
            <AnimatePresence>
                {isSignup && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                        <Input icon={Lock} type={showConfirm ? 'text' : 'password'} value={confirm}
                            onChange={(e: any) => { setConfirm(e.target.value); setErrs(p => ({ ...p, confirm: '' })); }}
                            placeholder="Xác nhận mật khẩu" autoComplete="new-password" disabled={loading}
                            error={errs.confirm} right={eyeBtn(showConfirm, () => setShowConfirm(v => !v))} />
                    </motion.div>
                )}
            </AnimatePresence>
            <SubmitBtn loading={loading} label={isSignup ? 'Tạo Tài Khoản' : 'Vào Thôi !'} loadingLabel={isSignup ? 'Đang tạo...' : 'Đang vào...'} />
            {!isSignup && (
                <button type="button" onClick={goToForgotPassword} className="w-full text-xs font-semibold text-gray-400 hover:text-[#FF7FA3] py-0.5 transition-colors">
                    Quên mật khẩu?
                </button>
            )}
            <button type="button" onClick={() => setAuthMode(isSignup ? 'login' : 'signup')} disabled={loading}
                className="w-full text-xs font-semibold text-gray-400 hover:text-[#FF7FA3] py-1 transition-colors disabled:opacity-50">
                {isSignup ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Đăng ký ngay'}
            </button>
        </form>
    </>);
}
