import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, ChevronLeft, ChevronRight, Flame, AlertTriangle } from 'lucide-react';
import { apiGetInsights, apiDismissInsight } from '../services/api';

export interface Insight {
    id: string;
    type: 'SPIKE' | 'BURN_RATE' | 'PARETO' | 'SUBSCRIPTION' | 'CONCEPT_DRIFT' | 'HEALTH';
    severity: 'low' | 'medium' | 'high';
    jar_id?: string | null;
    tx_id?: string | null;
    title: string;
    message: string;
    suggestion?: string | null;
    evidence?: any;
    created_at: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; iconBg: string; iconColor: string; titleColor: string }> = {
    high: {
        bg: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
        border: '#fecdd3',
        iconBg: 'linear-gradient(135deg, #f43f5e, #e11d48)',
        iconColor: '#ffffff',
        titleColor: '#be123c',
    },
    medium: {
        bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
        border: '#fed7aa',
        iconBg: 'linear-gradient(135deg, #f97316, #ea580c)',
        iconColor: '#ffffff',
        titleColor: '#c2410c',
    },
    low: {
        bg: 'linear-gradient(135deg, #fdf4ff 0%, #fce7f3 100%)',
        border: '#e9d5ff',
        iconBg: 'linear-gradient(135deg, #a855f7, #ec4899)',
        iconColor: '#ffffff',
        titleColor: '#7e22ce',
    },
};

function getIcon(type: string) {
    if (type === 'SPIKE') return Flame;
    if (type === 'BURN_RATE') return AlertTriangle;
    return Sparkles;
}

interface InsightsCarouselProps {
    refreshKey?: number; // bump để force reload
}

export function InsightsCarousel({ refreshKey }: InsightsCarouselProps) {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeIdx, setActiveIdx] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchInsights = async () => {
        try {
            const res = await apiGetInsights();
            if (res.data.success) {
                setInsights(res.data.insights);
            }
        } catch (err) {
            // Silent fail - không phải feature bắt buộc
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, [refreshKey]);

    const handleDismiss = async (id: string) => {
        // Optimistic update
        setInsights(prev => prev.filter(i => i.id !== id));
        try {
            await apiDismissInsight(id);
        } catch (err) {
            // Revert nếu lỗi
            fetchInsights();
        }
    };

    const scrollToIdx = (idx: number) => {
        if (!scrollRef.current) return;
        const card = scrollRef.current.children[idx] as HTMLElement;
        if (card) {
            scrollRef.current.scrollTo({ left: card.offsetLeft - 16, behavior: 'smooth' });
            setActiveIdx(idx);
        }
    };

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const scrollLeft = scrollRef.current.scrollLeft;
        const cardWidth = scrollRef.current.children[0]?.clientWidth || 1;
        const newIdx = Math.round(scrollLeft / cardWidth);
        if (newIdx !== activeIdx) setActiveIdx(newIdx);
    };

    if (loading) return null;
    if (insights.length === 0) return null; // Ẩn carousel khi không có insight

    return (
        <div className="space-y-2" data-testid="insights-carousel">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-extrabold text-gray-700 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-500" />
                    Bé Trứng phát hiện
                </h3>
                {insights.length > 1 && (
                    <div className="flex gap-1">
                        <button
                            onClick={() => scrollToIdx(Math.max(0, activeIdx - 1))}
                            disabled={activeIdx === 0}
                            className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30"
                            data-testid="insights-prev-btn"
                        >
                            <ChevronLeft size={14} className="text-gray-500" />
                        </button>
                        <button
                            onClick={() => scrollToIdx(Math.min(insights.length - 1, activeIdx + 1))}
                            disabled={activeIdx >= insights.length - 1}
                            className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30"
                            data-testid="insights-next-btn"
                        >
                            <ChevronRight size={14} className="text-gray-500" />
                        </button>
                    </div>
                )}
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-1 px-1 pb-2 no-scrollbar"
                style={{ scrollbarWidth: 'none' }}
            >
                <AnimatePresence initial={false}>
                    {insights.map((insight, idx) => {
                        const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.low;
                        const Icon = getIcon(insight.type);
                        return (
                            <motion.div
                                key={insight.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                className="snap-center shrink-0 w-[88%] rounded-[24px] p-4 relative"
                                style={{
                                    background: style.bg,
                                    border: `1px solid ${style.border}`,
                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                                }}
                                data-testid={`insight-card-${idx}`}
                            >
                                <button
                                    onClick={() => handleDismiss(insight.id)}
                                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-white/60 text-gray-400 hover:text-gray-600 hover:bg-white transition-colors"
                                    data-testid={`insight-dismiss-${idx}`}
                                >
                                    <X size={12} />
                                </button>

                                <div className="flex items-start gap-3 pr-6">
                                    <div
                                        className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                                        style={{ background: style.iconBg }}
                                    >
                                        <Icon size={16} color={style.iconColor} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-extrabold mb-1" style={{ color: style.titleColor }}>
                                            {insight.title}
                                        </p>
                                        <p className="text-xs font-medium text-gray-700 leading-relaxed">
                                            {insight.message}
                                        </p>
                                        {insight.suggestion && (
                                            <p className="text-[11px] italic font-medium text-gray-500 mt-1.5 leading-relaxed">
                                                💡 {insight.suggestion}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {insights.length > 1 && (
                <div className="flex justify-center gap-1.5 pt-1">
                    {insights.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => scrollToIdx(i)}
                            className={`h-1.5 rounded-full transition-all ${i === activeIdx ? 'w-5 bg-purple-400' : 'w-1.5 bg-gray-300'}`}
                            aria-label={`Go to insight ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
