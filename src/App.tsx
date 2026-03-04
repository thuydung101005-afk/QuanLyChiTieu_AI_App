import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Wallet, 
  Plus, 
  History, 
  User, 
  ChevronRight, 
  AlertCircle, 
  Send,
  Utensils,
  Car,
  Home,
  Gamepad2,
  MoreHorizontal,
  BrainCircuit,
  Sparkles,
  ChevronDown,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { GiaoDich, Insight } from './types';
import { MOCK_USER, MOCK_TRANSACTIONS, MOCK_CATEGORIES, MOCK_BUDGETS } from './mockData';
import { aiPhanLoai, aiBoNaoPhanTich, aiBoNaoHoiThoai } from './services/aiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORY_ICONS: Record<string, any> = {
  AN_UONG: Utensils,
  DI_LAI: Car,
  NHA_CUA: Home,
  GIAI_TRI: Gamepad2,
  KHAC: MoreHorizontal,
};

// Helper to group transactions by date
const groupTransactionsByDate = (transactions: GiaoDich[]) => {
  const groups: Record<string, { date: Date; transactions: GiaoDich[]; total: number }> = {};
  
  transactions.forEach(tx => {
    const date = new Date(tx.ngayThucHien);
    const dateString = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    if (!groups[dateString]) {
      groups[dateString] = { date, transactions: [], total: 0 };
    }
    groups[dateString].transactions.push(tx);
    groups[dateString].total += tx.soTien;
  });

  return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
};

const formatRelativeDate = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hôm nay';
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return `${days[date.getDay()]}, ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'ai' | 'profile'>('home');
  const [transactions, setTransactions] = useState<GiaoDich[]>(MOCK_TRANSACTIONS);
  const [aiMessages, setAiMessages] = useState<{ text: string; isAi: boolean; suggestions?: string[] }[]>([
    { text: "Chào bạn! Tôi là Trợ lý AI. Tôi đã phân tích các giao dịch gần đây của bạn. Bạn muốn xem báo cáo chi tiêu hay kiểm tra ngân sách?", isAi: true, suggestions: ["Báo cáo chi tiêu", "Kiểm tra ngân sách"] }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [rawInput, setRawInput] = useState('');
  
  // Async States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'ai') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, isThinking, activeTab]);

  // AI Analysis (Não 2)
  const analysisData = useMemo(() => aiBoNaoPhanTich.phanTichChiTieu(transactions), [transactions]);
  const anomalies = useMemo(() => aiBoNaoPhanTich.timBatThuong(transactions), [transactions]);
  const insights = useMemo(() => aiBoNaoPhanTich.taoInsights(transactions, MOCK_BUDGETS), [transactions]);
  const totalSpent = useMemo(() => transactions.reduce((acc, t) => acc + t.soTien, 0), [transactions]);
  const totalBudget = useMemo(() => MOCK_BUDGETS.reduce((acc, b) => acc + b.soTienGioiHan, 0), [MOCK_BUDGETS]);
  const balance = 15000000 - totalSpent; // Mock initial balance

  const groupedTransactions = useMemo(() => groupTransactionsByDate(transactions), [transactions]);

  const handleSendMessage = (msg?: string) => {
    const text = msg || inputMessage;
    if (!text.trim() || isThinking) return;

    setAiMessages(prev => [...prev, { text, isAi: false }]);
    setInputMessage('');
    setIsThinking(true);

    setTimeout(() => {
      const response = aiBoNaoHoiThoai.xuLyTinNhan(text, insights);
      setIsThinking(false);
      setAiMessages(prev => [...prev, { 
        text: response.noiDung, 
        isAi: true, 
        suggestions: response.cauHoiTiepTheo 
      }]);
    }, 1500);
  };

  const handleAddTransaction = () => {
    if (!rawInput.trim() || isAnalyzing) return;
    
    setIsAnalyzing(true);

    setTimeout(() => {
      const parsedData = aiPhanLoai.xuLyDuLieuTho(rawInput);
      
      setIsAnalyzing(false);

      if (!parsedData) {
        alert("Không thể nhận diện số tiền. Vui lòng nhập lại (VD: ăn phở 50k)");
        return;
      }
      
      const newTx: GiaoDich = {
        maGiaoDich: Date.now(),
        soTien: parsedData.soTien,
        ngayThucHien: new Date(),
        moTa: parsedData.moTa,
        ghiChu: '',
        daXacNhan: true,
        maDanhMuc: parsedData.maDanhMuc,
      };

      setTransactions(prev => [newTx, ...prev]);
      setRawInput('');
      setShowAddModal(false);

      setActiveTab('ai');
      setIsThinking(true);
      
      setTimeout(() => {
        setIsThinking(false);
        setAiMessages(prev => [...prev, { 
          text: `Đã ghi nhận: "${parsedData.moTa}" (${parsedData.soTien.toLocaleString()}đ) vào mục "${MOCK_CATEGORIES.find(c => c.maDanhMuc === parsedData.maDanhMuc)?.tenDanhMuc}".`, 
          isAi: true,
          suggestions: ["Xem báo cáo", "Số dư hiện tại"]
        }]);
      }, 1000);

    }, 1500);
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex justify-center items-start p-0 md:p-8 font-sans">
      {/* Mobile Frame Simulation */}
      <div className="w-full max-w-[400px] h-[100vh] md:h-[800px] bg-zinc-50 shadow-2xl md:rounded-[40px] overflow-hidden flex flex-col border-[8px] border-zinc-900 relative">
        
        {/* Status Bar Simulation */}
        <div className={cn(
          "h-12 flex justify-between items-center px-6 pt-4 shrink-0 transition-colors duration-300",
          activeTab === 'ai' ? "bg-zinc-950 text-white" : "bg-zinc-950 text-white"
        )}>
          <span className="text-xs font-semibold">12:14</span>
          <div className="flex gap-1.5">
            <div className="w-4 h-2.5 bg-white rounded-sm" />
            <div className="w-4 h-2.5 bg-white rounded-sm" />
            <div className="w-6 h-2.5 bg-white rounded-sm" />
          </div>
        </div>

        {/* Dynamic Header */}
        <AnimatePresence mode="wait">
          {activeTab !== 'ai' && (
            <motion.header 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-zinc-950 px-6 pb-8 pt-2 shrink-0 text-white rounded-b-[32px] shadow-sm z-10 relative"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-full cursor-pointer">
                  <Wallet size={16} className="text-emerald-400" />
                  <span className="text-sm font-medium">Tiền mặt</span>
                  <ChevronDown size={16} className="text-zinc-400" />
                </div>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                  <User size={18} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-zinc-400 text-sm font-medium mb-1">Số dư hiện tại</p>
                <h1 className="text-4xl font-bold tracking-tight">{balance.toLocaleString()} <span className="text-2xl text-zinc-500 font-normal">đ</span></h1>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-28">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 pt-6"
              >
                {/* AI Insights Section */}
                {anomalies.length > 0 && (
                  <div className="mx-5 bg-orange-50 border border-orange-100 rounded-[24px] p-4 flex gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-orange-900">Cảnh báo chi tiêu</h3>
                      <p className="text-xs text-orange-700 mt-1 leading-relaxed">{anomalies[0].moTa}</p>
                      <button 
                        onClick={() => setActiveTab('ai')}
                        className="text-xs font-semibold text-orange-600 mt-2 flex items-center gap-1 hover:text-orange-800 transition-colors"
                      >
                        Hỏi AI giải pháp <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Monthly Overview */}
                <div className="mx-5 bg-white rounded-[24px] p-6 border border-zinc-100 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1">Tháng này đã chi</p>
                    <p className="text-xl font-bold text-zinc-800">{totalSpent.toLocaleString()} đ</p>
                  </div>
                  <div className="h-12 w-[1px] bg-zinc-100" />
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 font-medium mb-1">Ngân sách còn lại</p>
                    <p className="text-xl font-bold text-emerald-500">{(totalBudget - totalSpent).toLocaleString()} đ</p>
                  </div>
                </div>

                {/* Transactions Grouped by Date */}
                <div className="space-y-4 px-5">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold text-zinc-800">Giao dịch gần đây</h3>
                    <button onClick={() => setActiveTab('history')} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors">Xem tất cả</button>
                  </div>
                  
                  {groupedTransactions.slice(0, 3).map((group, idx) => (
                    <div key={idx} className="bg-white rounded-[24px] border border-zinc-100 shadow-sm overflow-hidden">
                      <div className="bg-zinc-50/80 px-5 py-3 border-b border-zinc-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-zinc-800 tracking-tight">{group.date.getDate()}</span>
                          <div>
                            <p className="text-xs font-semibold text-zinc-600">{formatRelativeDate(group.date).split(',')[0]}</p>
                            <p className="text-[10px] text-zinc-400 font-medium">Tháng {group.date.getMonth() + 1} {group.date.getFullYear()}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-zinc-800">-{group.total.toLocaleString()} đ</span>
                      </div>
                      <div className="divide-y divide-zinc-50">
                        {group.transactions.map((tx) => {
                          const category = MOCK_CATEGORIES.find(c => c.maDanhMuc === tx.maDanhMuc);
                          const Icon = CATEGORY_ICONS[tx.maDanhMuc] || MoreHorizontal;
                          return (
                            <div key={tx.maGiaoDich} className="flex items-center justify-between p-5 bg-white hover:bg-zinc-50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div 
                                  className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm"
                                  style={{ backgroundColor: category?.mauSac }}
                                >
                                  <Icon size={20} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-zinc-800">{tx.moTa}</p>
                                  <p className="text-xs text-zinc-500 mt-1 font-medium">{category?.tenDanhMuc}</p>
                                </div>
                              </div>
                              <p className="text-sm font-semibold text-zinc-800">-{tx.soTien.toLocaleString()}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div 
                key="ai"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full absolute inset-0 bg-zinc-950 z-20"
              >
                {/* Chat Header - Dark Theme */}
                <div className="h-24 bg-zinc-950 text-white flex items-end pb-4 px-6 gap-4 shrink-0 border-b border-white/10">
                  <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
                    <BrainCircuit size={24} className="text-violet-400" />
                  </div>
                  <div className="mb-1">
                    <h2 className="text-base font-semibold tracking-tight">Trợ lý AI (Não 3)</h2>
                    <p className="text-xs text-violet-300/70 flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" /> Trực tuyến
                    </p>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">
                  {aiMessages.map((msg, idx) => (
                    <div key={idx} className={cn("flex flex-col", msg.isAi ? "items-start" : "items-end")}>
                      <div className={cn(
                        "max-w-[85%] p-4 rounded-[24px] text-[15px] leading-relaxed shadow-sm",
                        msg.isAi 
                          ? "bg-zinc-900 border border-white/5 text-zinc-200 rounded-tl-sm" 
                          : "bg-violet-600 text-white rounded-tr-sm"
                      )}>
                        {msg.text}
                      </div>
                      {msg.isAi && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 ml-1">
                          {msg.suggestions.map((s, sIdx) => (
                            <button 
                              key={sIdx}
                              onClick={() => handleSendMessage(s)}
                              disabled={isThinking}
                              className="text-xs font-medium px-4 py-2 bg-zinc-900 text-violet-300 rounded-full hover:bg-zinc-800 transition-colors border border-white/5 disabled:opacity-50"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isThinking && (
                    <div className="flex flex-col items-start">
                      <div className="bg-zinc-900 border border-white/5 p-5 rounded-[24px] rounded-tl-sm shadow-sm flex items-center gap-2">
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-violet-400/50 rounded-full" />
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-violet-400/50 rounded-full" />
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-violet-400/50 rounded-full" />
                      </div>
                      <span className="text-xs text-zinc-500 mt-2 ml-2 font-medium">Não 3 đang phân tích...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-zinc-950 border-t border-white/10">
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Nhắn tin cho AI..."
                      disabled={isThinking}
                      className="w-full bg-zinc-900 border border-white/5 rounded-full pl-6 pr-14 py-4 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
                    />
                    <button 
                      onClick={() => handleSendMessage()}
                      disabled={isThinking || !inputMessage.trim()}
                      className="absolute right-2 w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-zinc-800 transition-colors"
                    >
                      <Send size={18} className="ml-0.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 pt-6 px-5"
              >
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold text-zinc-800 tracking-tight">Lịch sử giao dịch</h2>
                  <div className="flex items-center gap-1.5 text-sm text-zinc-600 font-medium bg-white border border-zinc-200 px-4 py-2 rounded-full shadow-sm">
                    <Calendar size={16} />
                    <span>Tháng này</span>
                  </div>
                </div>
                
                {groupedTransactions.map((group, idx) => (
                  <div key={idx} className="bg-white rounded-[24px] border border-zinc-100 shadow-sm overflow-hidden">
                    <div className="bg-zinc-50/80 px-5 py-3 border-b border-zinc-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-zinc-800 tracking-tight">{group.date.getDate()}</span>
                        <div>
                          <p className="text-xs font-semibold text-zinc-600">{formatRelativeDate(group.date).split(',')[0]}</p>
                          <p className="text-[10px] text-zinc-400 font-medium">Tháng {group.date.getMonth() + 1} {group.date.getFullYear()}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-zinc-800">-{group.total.toLocaleString()} đ</span>
                    </div>
                    <div className="divide-y divide-zinc-50">
                      {group.transactions.map((tx) => {
                        const category = MOCK_CATEGORIES.find(c => c.maDanhMuc === tx.maDanhMuc);
                        const Icon = CATEGORY_ICONS[tx.maDanhMuc] || MoreHorizontal;
                        return (
                          <div key={tx.maGiaoDich} className="flex items-center justify-between p-5 bg-white hover:bg-zinc-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm"
                                style={{ backgroundColor: category?.mauSac }}
                              >
                                <Icon size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-zinc-800">{tx.moTa}</p>
                                <p className="text-xs text-zinc-500 mt-1 font-medium">{category?.tenDanhMuc}</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-zinc-800">-{tx.soTien.toLocaleString()}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="h-[90px] bg-white border-t border-zinc-100 flex items-start justify-around px-2 pt-4 absolute bottom-0 left-0 right-0 z-30 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.03)] rounded-t-[32px]">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn("flex flex-col items-center gap-1.5 w-16 transition-colors", activeTab === 'home' ? "text-zinc-900" : "text-zinc-400")}
          >
            <Wallet size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Sổ giao dịch</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn("flex flex-col items-center gap-1.5 w-16 transition-colors", activeTab === 'history' ? "text-zinc-900" : "text-zinc-400")}
          >
            <History size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Lịch sử</span>
          </button>
          
          {/* Central FAB */}
          <div className="relative w-16 flex justify-center">
            <button 
              onClick={() => setShowAddModal(true)}
              className="absolute -top-10 w-16 h-16 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-xl shadow-zinc-900/20 hover:scale-105 transition-transform active:scale-95 border-[6px] border-zinc-50"
            >
              <Plus size={28} />
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('ai')}
            className={cn("flex flex-col items-center gap-1.5 w-16 transition-colors", activeTab === 'ai' ? "text-violet-600" : "text-zinc-400")}
          >
            <BrainCircuit size={24} strokeWidth={activeTab === 'ai' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">AI Brain</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn("flex flex-col items-center gap-1.5 w-16 transition-colors", activeTab === 'profile' ? "text-zinc-900" : "text-zinc-400")}
          >
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Tài khoản</span>
          </button>
        </nav>

        {/* Magic Bar Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md z-50 flex items-end justify-center"
              onClick={() => !isAnalyzing && setShowAddModal(false)}
            >
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-8" />
                
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                    <Sparkles size={20} className="text-zinc-900" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Thêm nhanh với AI</h2>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">Não 1 sẽ tự động phân loại</p>
                  </div>
                </div>
                
                <div className="relative">
                  <input 
                    type="text" 
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    placeholder="Gõ bất cứ gì, ví dụ: ăn trưa 70k"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-[24px] pl-6 pr-16 py-5 text-base text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all font-medium"
                    autoFocus
                    disabled={isAnalyzing}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTransaction()}
                  />
                  <button 
                    onClick={handleAddTransaction}
                    disabled={isAnalyzing || !rawInput.trim()}
                    className="absolute right-2.5 top-2.5 bottom-2.5 aspect-square bg-zinc-900 text-white rounded-[18px] flex items-center justify-center disabled:opacity-50 disabled:bg-zinc-300 transition-colors"
                  >
                    <Send size={20} className="ml-0.5" />
                  </button>
                </div>

                <AnimatePresence>
                  {isAnalyzing && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="flex flex-col items-center justify-center gap-3 text-zinc-600 overflow-hidden"
                    >
                      <div className="flex items-center gap-2">
                        <BrainCircuit size={18} className="animate-pulse" />
                        <span className="text-sm font-semibold">Đang phân tích và cấu trúc hóa...</span>
                      </div>
                      <div className="w-48 h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-1">
                        <motion.div 
                          className="h-full bg-zinc-900 rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
