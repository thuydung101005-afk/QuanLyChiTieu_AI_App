import React from 'react';
import { motion } from 'motion/react';
import type { AuthMode } from '../types';

interface AuthScreenProps {
    authMode: AuthMode;
    setAuthMode: (mode: AuthMode) => void;
    authUsername: string;
    setAuthUsername: (v: string) => void;
    authPassword: string;
    setAuthPassword: (v: string) => void;
    authError: string;
    handleAuth: () => void;
}

export function AuthScreen({
    authMode, setAuthMode, authUsername, setAuthUsername,
    authPassword, setAuthPassword, authError, handleAuth,
}: AuthScreenProps) {
    return (
        <div className="min-h-screen bg-[#FCFAFA] flex justify-center items-center p-4 font-sans">
            <div className="w-full max-w-[400px] bg-white rounded-[40px] p-8 shadow-2xl border-[8px] border-[#FFE5E5] flex flex-col items-center">
                {/* Egg Mascot */}
                <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                    className="w-24 h-32 bg-[#FFF4DC] rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.05),_4px_4px_10px_rgba(0,0,0,0.1)] border border-yellow-100 flex items-center justify-center relative overflow-hidden mb-6"
                >
                    <div className="absolute top-10 left-4 w-3 h-3 bg-gray-800 rounded-full" />
                    <div className="absolute top-10 right-4 w-3 h-3 bg-gray-800 rounded-full" />
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 w-4 h-2 bg-pink-400 rounded-full" />
                    <div className="absolute top-10 left-2 w-2 h-2 bg-pink-200 rounded-full opacity-60" />
                </motion.div>

                <h1 className="text-3xl font-extrabold text-[#FF7FA3] mb-2">
                    {authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}
                </h1>
                <p className="text-sm text-gray-400 font-bold mb-8">Bé Trứng đợi bạn nãy giờ nè!</p>

                {authError && (
                    <p className="text-xs text-red-400 font-bold w-full text-center px-4 py-2 bg-red-50 rounded-lg mb-4">
                        {authError}
                    </p>
                )}

                <div className="w-full space-y-4">
                    <input
                        type="text"
                        value={authUsername}
                        onChange={e => setAuthUsername(e.target.value)}
                        placeholder="Tên tài khoản"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
                    />
                    <input
                        type="password"
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAuth()}
                        placeholder="Mật khẩu"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
                    />
                    <button
                        onClick={handleAuth}
                        className="w-full bg-[#FF7FA3] text-white font-extrabold py-4 rounded-2xl shadow-[0_8px_20px_rgba(255,127,163,0.3)] hover:bg-[#ff6b93] hover:-translate-y-1 transition-all active:scale-95"
                    >
                        {authMode === 'login' ? 'Vào Thôi !' : 'Tạo Tài Khoản'}
                    </button>
                    <button
                        onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                        className="w-full text-xs font-bold text-gray-400 hover:text-[#FF7FA3] py-2 transition-colors"
                    >
                        {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                    </button>
                </div>
            </div>
        </div>
    );
}
