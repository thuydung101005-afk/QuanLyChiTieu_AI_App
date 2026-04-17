import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useToast, type ToastType } from '../contexts/ToastContext';

const CONFIG: Record<ToastType, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    success: {
        bg: 'bg-white',
        border: 'border-green-400',
        text: 'text-green-700',
        icon: <CheckCircle2 size={18} className="text-green-500 shrink-0" />,
    },
    error: {
        bg: 'bg-white',
        border: 'border-red-400',
        text: 'text-red-700',
        icon: <XCircle size={18} className="text-red-500 shrink-0" />,
    },
    info: {
        bg: 'bg-white',
        border: 'border-blue-400',
        text: 'text-blue-700',
        icon: <Info size={18} className="text-blue-500 shrink-0" />,
    },
};

export function ToastContainer() {
    const { toasts, remove } = useToast();

    const root = document.getElementById('app-modal-root');
    if (!root) return null;

    return createPortal(
        <div className="absolute top-4 left-0 right-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none">
            <AnimatePresence>
                {toasts.map(t => {
                    const cfg = CONFIG[t.type];
                    return (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -12, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
                            className={`w-full max-w-[360px] flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg border-l-4 pointer-events-auto ${cfg.bg} ${cfg.border}`}
                        >
                            {cfg.icon}
                            <p className={`flex-1 text-sm font-semibold leading-snug ${cfg.text}`}>{t.message}</p>
                            <button
                                onClick={() => remove(t.id)}
                                className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5"
                            >
                                <X size={14} />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>,
        root
    );
}
