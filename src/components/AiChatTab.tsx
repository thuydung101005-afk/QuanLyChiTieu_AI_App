import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiSendChat } from '../services/api';
import { ChickMascot } from './ChickMascot';
import type { ChatMessage } from '../types';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface AiChatTabProps {
    userId: string;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    inputMessage: string;
    setInputMessage: (v: string) => void;
    isThinking: boolean;
    setIsThinking: (v: boolean) => void;
}

export function AiChatTab({
    userId, messages, setMessages, inputMessage, setInputMessage, isThinking, setIsThinking
}: AiChatTabProps) {
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleSend = async (msg?: string) => {
        const text = msg || inputMessage;
        if (!text.trim() || isThinking) return;

        setMessages(prev => [...prev, { text, isAi: false }]);
        setInputMessage('');
        setIsThinking(true);

        try {
            const res = await apiSendChat(text);
            setMessages(prev => [...prev, {
                text: res.data.reply,
                isAi: true,
                suggestions: res.data.suggestions,
            }]);
        } catch {
            setMessages(prev => [...prev, {
                text: 'Ối, hệ thống não của Trứng bị lỗi xíu xiu rồi :(',
                isAi: true,
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <motion.div
            key="ai"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col h-full absolute inset-0 bg-[#FFF7F0] z-20"
        >
            {/* Chat Header */}
            <div className="h-36 bg-white rounded-b-[40px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col items-center justify-end pb-3 shrink-0">
                <ChickMascot size={0.55} />
                <h2 className="text-base font-extrabold text-orange-400 tracking-tight mt-1">Trứng-kun Trợ Lý</h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-24">
                {messages.map((msg, idx) => {
                    const renderMessage = (text: string) => {
                        const parts = text.split(/(\*\*.*?\*\*)/g);
                        return parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={i} className="font-extrabold">{part.slice(2, -2)}</strong>;
                            }
                            return part;
                        });
                    };

                    return (
                        <div key={idx} className={cn('flex flex-col', msg.isAi ? 'items-start' : 'items-end')}>
                            <div className={cn(
                                'max-w-[85%] px-5 py-3.5 rounded-[28px] text-[15px] font-medium leading-relaxed shadow-sm',
                                msg.isAi
                                    ? 'bg-white text-gray-700 rounded-tl-md border border-gray-100 whitespace-pre-wrap'
                                    : 'bg-[#FFB5A7] text-gray-900 rounded-tr-md font-bold whitespace-pre-wrap'
                            )}>
                                {renderMessage(msg.text)}
                            </div>
                        {msg.isAi && msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 ml-2">
                                {msg.suggestions.map((s, sIdx) => (
                                    <button
                                        key={sIdx}
                                        onClick={() => handleSend(s)}
                                        disabled={isThinking}
                                        className="text-xs font-bold px-4 py-2 bg-white text-orange-400 rounded-full hover:bg-orange-50 transition-colors border border-orange-100 shadow-sm"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )})}

                {isThinking && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 p-4 bg-white rounded-full w-20 shadow-sm border border-gray-100 ml-2">
                        {[0, 0.2, 0.4].map((delay, i) => (
                            <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay }} className="w-2.5 h-2.5 bg-orange-300 rounded-full" />
                        ))}
                    </motion.div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#FFF7F0] via-[#FFF7F0] to-transparent">
                <div className="relative flex items-center shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-full">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={e => setInputMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Trò chuyện với bé Trứng..."
                        disabled={isThinking}
                        className="w-full bg-white border border-transparent rounded-[30px] pl-6 pr-14 py-4 text-sm text-gray-800 font-bold placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all shadow-sm"
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={isThinking || !inputMessage.trim()}
                        className="absolute right-2 w-10 h-10 rounded-full bg-[#FFB5A7] text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        <Send size={18} className="translate-x-[1px]" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
