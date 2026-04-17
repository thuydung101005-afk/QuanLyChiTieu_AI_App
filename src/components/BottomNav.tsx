import React from 'react';
import { Home, History, Plus, User, PieChart } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ActiveTab } from '../types';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface BottomNavProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
    onAddClick: () => void;
    clock: string;
}

export function BottomNav({ activeTab, onTabChange, onAddClick, clock }: BottomNavProps) {
    return (
        <nav className="h-[90px] bg-white flex items-start justify-around px-2 pt-4 absolute bottom-0 left-0 right-0 z-30 pb-safe shadow-[0_-20px_40px_rgba(0,0,0,0.03)] rounded-t-[40px] border-t border-gray-50">
            <button
                onClick={() => onTabChange('home')}
                className={cn('flex flex-col items-center gap-1 w-[42px] transition-colors', activeTab === 'home' ? 'text-[#FF7FA3]' : 'text-gray-300')}
            >
                <Home size={22} strokeWidth={activeTab === 'home' ? 3 : 2} />
                <span className="text-[9px] font-extrabold line-clamp-1">Trang chủ</span>
            </button>

            <button
                onClick={() => onTabChange('history')}
                className={cn('flex flex-col items-center gap-1 w-[42px] transition-colors', activeTab === 'history' ? 'text-[#FFB5A7]' : 'text-gray-300')}
            >
                <History size={22} strokeWidth={activeTab === 'history' ? 3 : 2} />
                <span className="text-[9px] font-extrabold line-clamp-1">Lịch sử</span>
            </button>

            <button
                onClick={() => onTabChange('report')}
                className={cn('flex flex-col items-center gap-1 w-[42px] transition-colors', activeTab === 'report' ? 'text-[#a78bfa]' : 'text-gray-300')}
            >
                <PieChart size={22} strokeWidth={activeTab === 'report' ? 3 : 2} />
                <span className="text-[9px] font-extrabold line-clamp-1">Báo cáo</span>
            </button>

            {/* Central FAB is kept the same */}

            {/* Central FAB */}
            <div className="relative w-16 flex justify-center">
                <button
                    onClick={onAddClick}
                    className="absolute -top-12 w-16 h-16 rounded-full bg-[#FFD1DA] text-pink-600 flex items-center justify-center shadow-[0_10px_25px_rgba(255,209,218,0.5)] hover:bg-[#ffbdc9] transition-all hover:scale-105 active:scale-95 border-4 border-white"
                >
                    <Plus size={30} strokeWidth={3} />
                </button>
            </div>

            <button
                onClick={() => onTabChange('ai')}
                className={cn('flex flex-col items-center gap-1 w-[42px] transition-colors', activeTab === 'ai' ? 'text-orange-400' : 'text-gray-300')}
            >
                <div className={`w-[22px] h-[22px] border-2 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] ${activeTab === 'ai' ? 'border-orange-400 bg-orange-50' : 'border-gray-300'}`} />
                <span className="text-[9px] font-extrabold line-clamp-1">Trợ Lý</span>
            </button>

            <button
                onClick={() => onTabChange('profile')}
                className={cn('flex flex-col items-center gap-1 w-[42px] transition-colors', activeTab === 'profile' ? 'text-[#8cbbe0]' : 'text-gray-300')}
            >
                <User size={22} strokeWidth={activeTab === 'profile' ? 3 : 2} />
                <span className="text-[9px] font-extrabold line-clamp-1">Tài Khoản</span>
            </button>
        </nav>
    );
}
