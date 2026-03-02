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
  Sparkles
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'ai' | 'profile'>('home');
  const [transactions, setTransactions] = useState<GiaoDich[]>(MOCK_TRANSACTIONS);
  const [aiMessages, setAiMessages] = useState<{ text: string; isAi: boolean; suggestions?: string[] }[]>([
    { text: "Chào bạn! Tôi là Người phát ngôn của Bộ não AI. Tôi đã nhận được các bản phân tích mới nhất. Bạn muốn biết về tổng quan chi tiêu, hay kiểm tra các cảnh báo ngân sách?", isAi: true, suggestions: ["Xem tổng quan", "Kiểm tra ngân sách"] }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [rawInput, setRawInput] = useState('');
  
  // Async States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom
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

  const handleSendMessage = (msg?: string) => {
    const text = msg || inputMessage;
    if (!text.trim() || isThinking) return;

    setAiMessages(prev => [...prev, { text, isAi: false }]);
    setInputMessage('');
    setIsThinking(true);

    // Simulate AI thinking (Não 2 + Não 3)
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

    // Simulate async processing by Não 1 (1.5s delay)
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

      // Navigate to AI tab and show success message from Não 3
      setActiveTab('ai');
      setIsThinking(true);
      
      setTimeout(() => {
        setIsThinking(false);
        setAiMessages(prev => [...prev, { 
          text: `Tôi đã ghi nhận giao dịch "${parsedData.moTa}" (${parsedData.soTien.toLocaleString()}đ) vào mục "${MOCK_CATEGORIES.find(c => c.maDanhMuc === parsedData.maDanhMuc)?.tenDanhMuc}".`, 
          isAi: true,
          suggestions: ["Xem tổng quan", "Kiểm tra ngân sách"]
        }]);
      }, 1000);

    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start p-0 md:p-8 font-sans">
      {/* Mobile Frame Simulation */}
      <div className="w-full max-w-[400px] h-[100vh] md:h-[800px] bg-[#F9FAFB] shadow-2xl md:rounded-[40px] overflow-hidden flex flex-col border-[8px] border-slate-900 relative">
        
        {/* Status Bar Simulation */}
        <div className="h-12 flex justify-between items-center px-8 pt-4 shrink-0">
          <span className="text-xs font-semibold text-slate-800">12:14</span>
          <div className="flex gap-1.5">
            <div className="w-4 h-2.5 bg-slate-800 rounded-sm" />
            <div className="w-4 h-2.5 bg-slate-800 rounded-sm" />
            <div className="w-6 h-2.5 bg-slate-800 rounded-sm" />
          </div>
        </div>

        {/* Header */}
        <header className="px-6 py-2 flex justify-between items-center shrink-0">
          <div>
            <p className="text-slate-500 text-xs font-medium">Chào buổi sáng,</p>
            <h1 className="text-xl font-semibold text-slate-800">{MOCK_USER.ten}</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
            <User size={20} />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-6 pb-28 pt-4">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Budget Card - Minimalist */}
                <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm">
                  <p className="text-slate-500 text-sm font-medium">Tổng chi tiêu tháng này</p>
                  <h2 className="text-3xl font-semibold text-slate-800 mt-1">{totalSpent.toLocaleString()}đ</h2>
                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between text-xs font-medium text-slate-500">
                      <span>Hạn mức: {totalBudget.toLocaleString()}đ</span>
                      <span>{Math.round((totalSpent / totalBudget) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
                        className="h-full bg-indigo-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                {/* AI Insights Section */}
                {anomalies.length > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-[20px] p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-orange-900">Phát hiện bất thường</h3>
                      <p className="text-xs text-orange-700 mt-1 leading-relaxed">{anomalies[0].moTa}</p>
                      <button 
                        onClick={() => setActiveTab('ai')}
                        className="text-xs font-semibold text-orange-600 mt-2 flex items-center gap-1"
                      >
                        Hỏi AI giải pháp <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Chart */}
                <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4">Phân tích hạng mục</h3>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analysisData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
                          tickFormatter={(val) => MOCK_CATEGORIES.find(c => c.maDanhMuc === val)?.tenDanhMuc || val}
                        />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => [value.toLocaleString() + 'đ', 'Số tiền']}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                          {analysisData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={MOCK_CATEGORIES.find(c => c.maDanhMuc === entry.name)?.mauSac || '#8884d8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-slate-800">Giao dịch gần đây</h3>
                    <button onClick={() => setActiveTab('history')} className="text-xs font-semibold text-indigo-500">Tất cả</button>
                  </div>
                  <div className="space-y-3">
                    {transactions.slice(0, 3).map((tx) => {
                      const category = MOCK_CATEGORIES.find(c => c.maDanhMuc === tx.maDanhMuc);
                      const Icon = CATEGORY_ICONS[tx.maDanhMuc] || MoreHorizontal;
                      return (
                        <div key={tx.maGiaoDich} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-[20px] shadow-sm">
                          <div className="flex items-center gap-4">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                              style={{ backgroundColor: category?.mauSac }}
                            >
                              <Icon size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{tx.moTa}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{category?.tenDanhMuc}</p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-slate-800">-{tx.soTien.toLocaleString()}đ</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div 
                key="ai"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full absolute inset-0 bg-[#F9FAFB]"
              >
                {/* Chat Header */}
                <div className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-6 gap-3 shrink-0 z-10 pt-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Trợ lý AI (Não 3)</h2>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Trực tuyến
                    </p>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                  {aiMessages.map((msg, idx) => (
                    <div key={idx} className={cn("flex flex-col", msg.isAi ? "items-start" : "items-end")}>
                      <div className={cn(
                        "max-w-[80%] p-3.5 rounded-[20px] text-[14px] leading-relaxed shadow-sm",
                        msg.isAi 
                          ? "bg-white border border-slate-100 text-slate-800 rounded-tl-sm" 
                          : "bg-indigo-500 text-white rounded-tr-sm"
                      )}>
                        {msg.text}
                      </div>
                      {msg.isAi && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 ml-1">
                          {msg.suggestions.map((s, sIdx) => (
                            <button 
                              key={sIdx}
                              onClick={() => handleSendMessage(s)}
                              disabled={isThinking}
                              className="text-[11px] font-medium px-3 py-1.5 bg-white text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors border border-indigo-100 shadow-sm disabled:opacity-50"
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
                      <div className="bg-white border border-slate-100 p-4 rounded-[20px] rounded-tl-sm shadow-sm flex items-center gap-1.5">
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 ml-2">Não 3 đang phân tích...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100">
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Nhắn tin cho AI..."
                      disabled={isThinking}
                      className="w-full bg-slate-100 border-none rounded-full pl-5 pr-12 py-3.5 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                    />
                    <button 
                      onClick={() => handleSendMessage()}
                      disabled={isThinking || !inputMessage.trim()}
                      className="absolute right-1.5 w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-slate-300 transition-colors"
                    >
                      <Send size={16} className="ml-0.5" />
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
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-slate-800">Lịch sử giao dịch</h2>
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const category = MOCK_CATEGORIES.find(c => c.maDanhMuc === tx.maDanhMuc);
                    const Icon = CATEGORY_ICONS[tx.maDanhMuc] || MoreHorizontal;
                    return (
                      <div key={tx.maGiaoDich} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-[20px] shadow-sm">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: category?.mauSac }}
                          >
                            <Icon size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{tx.moTa}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{new Date(tx.ngayThucHien).toLocaleDateString('vi-VN')}</p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-slate-800">-{tx.soTien.toLocaleString()}đ</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Floating Action Button */}
        <button 
          onClick={() => setShowAddModal(true)}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-200 z-30 hover:scale-105 transition-transform active:scale-95"
        >
          <Plus size={28} />
        </button>

        {/* Bottom Navigation */}
        <nav className="h-[88px] bg-white border-t border-slate-100 flex items-start justify-around px-2 pt-4 absolute bottom-0 left-0 right-0 z-20 pb-safe">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn("flex flex-col items-center gap-1.5 w-16", activeTab === 'home' ? "text-indigo-600" : "text-slate-400")}
          >
            <Wallet size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Ví</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn("flex flex-col items-center gap-1.5 w-16", activeTab === 'history' ? "text-indigo-600" : "text-slate-400")}
          >
            <History size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Lịch sử</span>
          </button>
          <div className="w-16" /> {/* Space for FAB */}
          <button 
            onClick={() => setActiveTab('ai')}
            className={cn("flex flex-col items-center gap-1.5 w-16", activeTab === 'ai' ? "text-indigo-600" : "text-slate-400")}
          >
            <BrainCircuit size={24} strokeWidth={activeTab === 'ai' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Trợ lý AI</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn("flex flex-col items-center gap-1.5 w-16", activeTab === 'profile' ? "text-indigo-600" : "text-slate-400")}
          >
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">Tôi</span>
          </button>
        </nav>

        {/* Magic Bar Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end justify-center"
              onClick={() => !isAnalyzing && setShowAddModal(false)}
            >
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full bg-white rounded-t-[32px] p-6 pb-12 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={20} className="text-indigo-500" />
                  <h2 className="text-lg font-semibold text-slate-800">Thanh Ma Thuật</h2>
                </div>
                
                <div className="relative">
                  <input 
                    type="text" 
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    placeholder="Gõ bất cứ gì, ví dụ: ăn trưa 70k"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[20px] pl-5 pr-14 py-4 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    autoFocus
                    disabled={isAnalyzing}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTransaction()}
                  />
                  <button 
                    onClick={handleAddTransaction}
                    disabled={isAnalyzing || !rawInput.trim()}
                    className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-500 text-white rounded-2xl flex items-center justify-center disabled:opacity-50 disabled:bg-slate-300 transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>

                <AnimatePresence>
                  {isAnalyzing && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="flex flex-col items-center justify-center gap-2 text-indigo-500 overflow-hidden"
                    >
                      <div className="flex items-center gap-2">
                        <BrainCircuit size={16} className="animate-pulse" />
                        <span className="text-sm font-medium">Não 1 đang phân tích và cấu trúc hóa...</span>
                      </div>
                      <div className="w-48 h-1 bg-indigo-100 rounded-full overflow-hidden mt-2">
                        <motion.div 
                          className="h-full bg-indigo-500 rounded-full"
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
