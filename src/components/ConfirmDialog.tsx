import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    open,
    title = 'Xác nhận',
    message,
    confirmLabel = 'OK',
    cancelLabel = 'Huỷ',
    danger = true,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const root = document.getElementById('app-modal-root');
    if (!root) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="absolute inset-0 z-[200] flex items-center justify-center p-6 pointer-events-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.45 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="absolute inset-0 bg-black"
                    />

                    {/* Dialog Box */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 16 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                        className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-[300px] p-6 flex flex-col items-center text-center"
                    >
                        {/* Icon */}
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${danger ? 'bg-red-50' : 'bg-blue-50'}`}>
                            <AlertTriangle size={28} className={danger ? 'text-red-400' : 'text-blue-400'} />
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-extrabold text-gray-800 mb-2">{title}</h3>

                        {/* Message */}
                        <p className="text-sm font-medium text-gray-500 leading-relaxed mb-6">{message}</p>

                        {/* Buttons */}
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-3 rounded-2xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors ${
                                    danger
                                        ? 'bg-red-400 hover:bg-red-500'
                                        : 'bg-[#FF7FA3] hover:bg-[#e05f84]'
                                }`}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        root
    );
}
