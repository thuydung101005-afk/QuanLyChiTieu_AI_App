import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { Wallet, ChevronDown, User } from 'lucide-react';

import { useAuth } from './hooks/useAuth';
import { useFinanceData } from './hooks/useFinanceData';

import { AuthScreen } from './components/AuthScreen';
import { HomeTab } from './components/HomeTab';
import { HistoryTab } from './components/HistoryTab';
import { ReportTab } from './components/ReportTab';
import { AiChatTab } from './components/AiChatTab';
import { ProfileTab } from './components/ProfileTab';
import { MagicInputBar } from './components/MagicInputBar';
import { BottomNav } from './components/BottomNav';
import { ChickMascot } from './components/ChickMascot';

import type { ActiveTab, ChatMessage } from './types';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ToastContainer';

export default function App() {
  const auth = useAuth();
  const finance = useFinanceData(auth.userId);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [showAddModal, setShowAddModal] = useState(false);

  // AI Chat state (kept here so messages survive tab switches)
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    { text: 'Trứng-kun xin chào! Cậu muốn tớ xem qua các hũ ngân sách hay phân tích chi tiêu nào?', isAi: true, suggestions: ['Xem ngân sách', 'Phân tích chi tiêu'] }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Real-time clock
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    };
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (auth.isAuthenticated) finance.fetchDashboardData();
  }, [auth.isAuthenticated]);

  // Loading spinner while restoring session
  if (auth.isRestoring) {
    return (
      <div className="min-h-screen bg-[#FCFAFA] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-[#FFD1DA] border-t-[#FF7FA3] rounded-full"
        />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        authMode={auth.authMode} setAuthMode={auth.setAuthMode}
        authUsername={auth.authUsername} setAuthUsername={auth.setAuthUsername}
        authPassword={auth.authPassword} setAuthPassword={auth.setAuthPassword}
        authError={auth.authError}
        handleAuth={auth.handleAuth}
      />
    );
  }

  return (
    <ToastProvider>
    <div className="min-h-screen bg-[#FCFAFA] flex justify-center items-start p-0 md:p-8 font-sans">
      <div className="w-full max-w-[400px] h-[100dvh] md:h-[800px] bg-white shadow-2xl md:rounded-[40px] overflow-hidden flex flex-col border-0 md:border-[8px] border-[#FFE5E5] relative">

        {/* Status Bar */}
        <div className="h-12 flex justify-between items-center px-6 pt-4 shrink-0 bg-white text-gray-800">
          <span className="text-xs font-semibold">{clock}</span>
          <div className="flex gap-1.5">
            <div className="w-4 h-2.5 bg-gray-300 rounded-sm" />
            <div className="w-4 h-2.5 bg-gray-300 rounded-sm" />
            <div className="w-6 h-2.5 bg-gray-800 rounded-sm" />
          </div>
        </div>

        {/* Scrollable Container for Header + Main Content */}
        <div className="flex-1 overflow-y-auto pb-28 bg-[#FDFBF7] relative min-h-0 no-scrollbar">
          
          {/* Dynamic Header (hidden on AI tab) */}
          <AnimatePresence mode="wait">
            {activeTab !== 'ai' && (
              <motion.header
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white px-6 pb-8 pt-2 shrink-0 z-10 rounded-b-[40px] shadow-sm mb-6"
              >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 bg-[#FFD1DA] px-4 py-2 rounded-full shadow-sm">
                  <Wallet size={16} className="text-[#FF7FA3]" />
                  <span className="text-sm font-bold text-gray-800">Tổng tài sản</span>
                  <ChevronDown size={16} className="text-gray-500" />
                </div>
                <div className="bg-[#FFF0B3] w-10 h-10 rounded-full flex items-center justify-center shadow-sm">
                  <User size={18} className="text-amber-600" />
                </div>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-2">
                  <ChickMascot size={1.0} />
                </div>
                <h1 className="text-4xl font-extrabold text-[#FF7FA3] tracking-tight">
                  {finance.totalBalance.toLocaleString()} <span className="text-2xl text-pink-300 font-bold">đ</span>
                </h1>
              </div>
              </motion.header>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <main className="px-5 pb-6">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <HomeTab
                jars={finance.jars}
                transactions={finance.transactions}
                totalBalance={finance.totalBalance}
                onViewHistory={() => setActiveTab('history')}
              />
            )}
            {activeTab === 'history' && (
              <HistoryTab
                userId={auth.userId!}
                jars={finance.jars}
                transactions={finance.transactions}
                onDeleteTransaction={finance.deleteTransaction}
                onRefresh={finance.fetchDashboardData}
              />
            )}
            {activeTab === 'report' && (
              <ReportTab
                jars={finance.jars}
                transactions={finance.transactions}
              />
            )}
            {activeTab === 'ai' && (
              <AiChatTab
                userId={auth.userId!}
                messages={aiMessages}
                setMessages={setAiMessages}
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                isThinking={isThinking}
                setIsThinking={setIsThinking}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileTab
                userId={auth.userId!}
                jars={finance.jars}
                onRefresh={finance.fetchDashboardData}
                onLogout={() => { auth.handleLogout(); setActiveTab('home'); }}
              />
            )}
            </AnimatePresence>
          </main>
        </div>

        {/* Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddClick={() => setShowAddModal(true)}
          clock={clock}
        />

        {/* Magic Input Bar Modal */}
        <AnimatePresence>
          {showAddModal && auth.userId && (
            <MagicInputBar
              userId={auth.userId}
              jars={finance.jars}
              onSuccess={finance.fetchDashboardData}
              onClose={() => setShowAddModal(false)}
            />
          )}
        </AnimatePresence>

        {/* Portal Root for nested modals */}
        <div id="app-modal-root" className="absolute inset-0 pointer-events-none z-[100]" />
        <ToastContainer />

      </div>
    </div>
    </ToastProvider>
  );
}
