import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { Wallet, ChevronDown, User, Bell, X, CheckCheck, Sparkles } from 'lucide-react';

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
import { apiGetNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead } from './services/api';

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

  useEffect(() => {
    setAiMessages([
      { text: 'Trứng-kun xin chào! Cậu muốn tớ xem qua các hũ ngân sách hay phân tích chi tiêu nào?', isAi: true, suggestions: ['Xem ngân sách', 'Phân tích chi tiêu'] }
    ]);
    setInputMessage('');
    setIsThinking(false);
    setNotifications([]);
    setShowNotifications(false);
  }, [auth.userId]);


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

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    if (!auth.isAuthenticated) return;
    try {
      const res = await apiGetNotifications();
      if (res.data.success) setNotifications(res.data.notifications);
    } catch (err) { }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every 60s
    return () => clearInterval(interval);
  }, [auth.isAuthenticated]);

  const handleMarkRead = async (id: string) => {
    try {
      await apiMarkNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) { }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) { }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const latestAiBanner = notifications.find(n => n.type === 'ai' && !n.is_read);

  const handleDismissBanner = async () => {
    if (latestAiBanner) await handleMarkRead(latestAiBanner.id);
  };

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
        authStep={auth.authStep}
        authUsername={auth.authUsername} setAuthUsername={auth.setAuthUsername}
        authPassword={auth.authPassword} setAuthPassword={auth.setAuthPassword}
        authEmail={auth.authEmail} setAuthEmail={auth.setAuthEmail}
        authError={auth.authError}
        pendingEmail={auth.pendingEmail}
        handleAuth={auth.handleAuth}
        handleVerifyOtp={auth.handleVerifyOtp}
        handleResendOtp={auth.handleResendOtp}
        handleForgotSendOtp={auth.handleForgotSendOtp}
        handleForgotVerifyOtp={auth.handleForgotVerifyOtp}
        handleForgotReset={auth.handleForgotReset}
        goToForgotPassword={auth.goToForgotPassword}
        goBackToForm={auth.goBackToForm}
      />
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#FCFAFA] flex justify-center items-start p-0 md:p-8 font-sans">
        <div className="w-full max-w-[400px] h-[100dvh] md:h-[800px] bg-white shadow-2xl md:rounded-[40px] overflow-hidden flex flex-col border-0 md:border-[8px] border-[#FFE5E5] relative">

          {/* Scrollable Container for Header + Main Content */}
          <div className="flex-1 overflow-y-auto pb-28 bg-[#FDFBF7] relative min-h-0 no-scrollbar">

            {/* Dynamic Header (hidden on AI tab) */}
            <AnimatePresence mode="wait">
              {activeTab !== 'ai' && (
                <motion.header
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-white px-6 pb-2 pt-2 shrink-0 z-10 rounded-b-[40px] shadow-sm mb-4"
                >
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 bg-[#FFD1DA] px-4 py-2 rounded-full shadow-sm">
                      <Wallet size={16} className="text-[#FF7FA3]" />
                      <span className="text-sm font-bold text-gray-800">Tổng tài sản</span>
                      <ChevronDown size={16} className="text-gray-500" />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowNotifications(true)}
                        className="relative bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-transform"
                      >
                        <Bell size={18} className="text-gray-500" />
                        {unreadCount > 0 && (
                          <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('profile')}
                        className="bg-[#FFF0B3] w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-transform"
                      >
                        <User size={18} className="text-amber-600" />
                      </button>
                    </div>
                  </div>
                  <div className="text-center pb-1">
                    <p className="text-xs font-bold text-gray-400 mb-1 tracking-wide uppercase">Tổng số dư</p>
                    <h1
                      className="text-5xl font-black tracking-tight leading-none mb-3 py-1"
                      style={{
                        fontFamily: "'Nunito', sans-serif",
                        background: 'linear-gradient(135deg, #FF6B9E 0%, #FF9A9E 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0px 4px 8px rgba(255, 107, 158, 0.25))'
                      }}
                    >
                      {finance.totalBalance.toLocaleString()}
                      <span className="text-2xl font-extrabold ml-1" style={{ WebkitTextFillColor: '#FFA4B6' }}>đ</span>
                    </h1>
                    <div className="flex justify-center -mb-2">
                      <ChickMascot size={0.43} />
                    </div>
                  </div>
                </motion.header>
              )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="px-5 pb-6">
              <AnimatePresence mode="wait">
                {activeTab === 'home' && (
                  <HomeTab
                    key={auth.userId}
                    userId={auth.userId!}
                    jars={finance.jars}
                    transactions={finance.transactions}
                    totalBalance={finance.totalBalance}
                    onViewHistory={() => setActiveTab('history')}
                  />
                )}
                {activeTab === 'home' && latestAiBanner && (
                  <motion.div
                    key="ai-banner"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 rounded-[24px] p-4 relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, #fdf4ff 0%, #fce7f3 100%)',
                      border: '1px solid #e9d5ff',
                      boxShadow: '0 4px 20px rgba(168, 85, 247, 0.1)'
                    }}
                  >
                    <button
                      onClick={handleDismissBanner}
                      className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-purple-100 text-purple-400 hover:bg-purple-200 transition-colors"
                    >
                      <X size={12} />
                    </button>
                    <div className="flex items-start gap-3 pr-6">
                      <div
                        className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
                      >
                        <Sparkles size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-purple-700 mb-1">{latestAiBanner.title}</p>
                        <p className="text-xs font-medium text-purple-600 leading-relaxed">{latestAiBanner.message}</p>
                      </div>
                    </div>
                  </motion.div>
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
                    onAIReportSent={fetchNotifications}
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
                    userProfile={auth.userProfile}
                    jars={finance.jars}
                    transactions={finance.transactions}
                    onRefresh={finance.fetchDashboardData}
                    onTokenUpdate={auth.updateToken}
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

          {/* Notification Drawer */}
          <AnimatePresence>
            {showNotifications && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }}
                  onClick={() => setShowNotifications(false)}
                  className="absolute inset-0 bg-black z-50"
                />
                <motion.div
                  initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute top-0 right-0 bottom-0 w-80 bg-[#FAFAFA] z-50 shadow-2xl flex flex-col rounded-l-[30px] overflow-hidden"
                >
                  <div className="px-5 py-6 bg-white flex justify-between items-center shadow-sm z-10">
                    <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                      <Bell size={20} className="text-[#FF7FA3]" />
                      Thông báo
                    </h2>
                    <button onClick={() => setShowNotifications(false)} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="px-5 py-3 flex justify-between items-center bg-white border-b border-gray-50">
                    <span className="text-xs font-bold text-gray-500">{unreadCount} tin mới</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs font-bold text-[#FF7FA3] flex items-center gap-1 hover:text-pink-500 transition-colors">
                        <CheckCheck size={14} /> Đọc tất cả
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {notifications.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <Bell size={24} className="text-gray-300" />
                        </div>
                        <p className="text-sm font-bold text-gray-400">Bạn chưa có thông báo nào cả.</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                          className={`p-4 rounded-2xl cursor-pointer transition-all ${notif.is_read
                              ? 'bg-white opacity-60'
                              : 'bg-white shadow-sm border border-pink-100 ring-1 ring-pink-50'
                            }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              {!notif.is_read && <div className="w-2 h-2 rounded-full bg-red-400 mt-1"></div>}
                              <h3 className={`font-bold text-sm ${notif.is_read ? 'text-gray-600' : 'text-gray-800'}`}>
                                {notif.title}
                              </h3>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap ml-2">
                              {new Date(notif.created_at).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className={`text-xs mt-1 ${notif.is_read ? 'text-gray-400' : 'text-gray-500 font-medium'}`}>
                            {notif.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

        </div>
      </div>
    </ToastProvider>
  );
}
