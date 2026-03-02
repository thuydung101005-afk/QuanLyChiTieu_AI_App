import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wallet, 
  Plus, 
  MessageSquare, 
  TrendingUp, 
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
  CheckCircle2,
  BrainCircuit
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

import { GiaoDich, KiemVuong, TraLoiAI } from './types';
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

  // AI Analysis
  const analysisData = useMemo(() => aiBoNaoPhanTich.phanTichChiTieu(transactions), [transactions]);
  const anomalies = useMemo(() => aiBoNaoPhanTich.timBatThuong(transactions), [transactions]);
  const insights = useMemo(() => aiBoNaoPhanTich.taoInsights(transactions, MOCK_BUDGETS), [transactions]);
  const totalSpent = useMemo(() => transactions.reduce((acc, t) => acc + t.soTien, 0), [transactions]);
  const totalBudget = useMemo(() => MOCK_BUDGETS.reduce((acc, b) => acc + b.soTienGioiHan, 0), [MOCK_BUDGETS]);

  const handleSendMessage = (msg?: string) => {
    const text = msg || inputMessage;
    if (!text.trim()) return;

    setAiMessages(prev => [...prev, { text, isAi: false }]);
    setInputMessage('');

    // Simulate AI thinking
    setTimeout(() => {
      const response = aiBoNaoHoiThoai.xuLyTinNhan(text, insights);
      setAiMessages(prev => [...prev, { 
        text: response.noiDung, 
        isAi: true, 
        suggestions: response.cauHoiTiepTheo 
      }]);
    }, 600);
  };

  const handleAddTransaction = () => {
    if (!rawInput) return;
    
    // Tầng 1: Phân loại (Perception Layer)
    const parsedData = aiPhanLoai.xuLyDuLieuTho(rawInput);
    
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

    // AI Feedback
    setTimeout(() => {
      setActiveTab('ai');
      setAiMessages(prev => [...prev, { 
        text: `Tôi đã ghi nhận giao dịch "${parsedData.moTa}" (${parsedData.soTien.toLocaleString()}đ) vào mục "${MOCK_CATEGORIES.find(c => c.maDanhMuc === parsedData.maDanhMuc)?.tenDanhMuc}".`, 
        isAi: true,
        suggestions: ["Xem tổng quan", "Kiểm tra ngân sách"]
      }]);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-start p-0 md:p-8 font-sans">
      {/* Mobile Frame Simulation */}
      <div className="w-full max-w-[420px] h-[100vh] md:h-[840px] bg-white shadow-2xl md:rounded-[3rem] overflow-hidden flex flex-col border-[8px] border-slate-900 relative">
        
        {/* Status Bar Simulation */}
        <div className="h-10 bg-white flex justify-between items-center px-8 pt-4">
          <span className="text-xs font-bold">12:14</span>
          <div className="flex gap-1">
            <div className="w-4 h-2 bg-slate-300 rounded-full" />
            <div className="w-4 h-2 bg-slate-300 rounded-full" />
            <div className="w-4 h-2 bg-slate-900 rounded-full" />
          </div>
        </div>

        {/* Header */}
        <header className="px-6 py-4 flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Chào mừng trở lại</p>
            <h1 className="text-xl font-bold text-slate-900">{MOCK_USER.ten}</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200">
            <User size={20} />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-6 pb-24">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Budget Card */}
                <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                  <div className="relative z-10">
                    <p className="text-indigo-100 text-sm font-medium">Tổng chi tiêu tháng này</p>
                    <h2 className="text-3xl font-bold mt-1">{totalSpent.toLocaleString()}đ</h2>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Hạn mức: {totalBudget.toLocaleString()}đ</span>
                        <span>{Math.round((totalSpent / totalBudget) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
                          className="h-full bg-white rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Insights Section */}
                {anomalies.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-900">Phát hiện bất thường</h3>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{anomalies[0].moTa}</p>
                      <button 
                        onClick={() => setActiveTab('ai')}
                        className="text-xs font-bold text-amber-600 mt-2 flex items-center gap-1"
                      >
                        Hỏi AI giải pháp <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Chart */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp size={16} className="text-indigo-600" />
                    Phân tích hạng mục
                  </h3>
                  <div className="h-48 w-full bg-slate-50 rounded-2xl p-2 border border-slate-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analysisData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickFormatter={(val) => MOCK_CATEGORIES.find(c => c.maDanhMuc === val)?.tenDanhMuc || val}
                        />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => [value.toLocaleString() + 'đ', 'Số tiền']}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {analysisData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={MOCK_CATEGORIES.find(c => c.maDanhMuc === entry.name)?.mauSac || '#8884d8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <History size={16} className="text-indigo-600" />
                      Giao dịch gần đây
                    </h3>
                    <button onClick={() => setActiveTab('history')} className="text-xs font-bold text-indigo-600">Tất cả</button>
                  </div>
                  <div className="space-y-3">
                    {transactions.slice(0, 3).map((tx) => {
                      const category = MOCK_CATEGORIES.find(c => c.maDanhMuc === tx.maDanhMuc);
                      const Icon = CATEGORY_ICONS[tx.maDanhMuc] || MoreHorizontal;
                      return (
                        <div key={tx.maGiaoDich} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                              style={{ backgroundColor: category?.mauSac }}
                            >
                              <Icon size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{tx.moTa}</p>
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{category?.tenDanhMuc}</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-slate-900">-{tx.soTien.toLocaleString()}đ</p>
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
                className="flex flex-col h-full"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Bộ não AI Tài chính</h2>
                    <p className="text-xs text-green-500 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      Đang trực tuyến
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-4 pb-4">
                  {aiMessages.map((msg, idx) => (
                    <div key={idx} className={cn("flex flex-col", msg.isAi ? "items-start" : "items-end")}>
                      <div className={cn(
                        "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                        msg.isAi 
                          ? "bg-slate-100 text-slate-800 rounded-tl-none" 
                          : "bg-indigo-600 text-white rounded-tr-none shadow-md"
                      )}>
                        {msg.text}
                      </div>
                      {msg.isAi && msg.suggestions && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {msg.suggestions.map((s, sIdx) => (
                            <button 
                              key={sIdx}
                              onClick={() => handleSendMessage(s)}
                              className="text-[10px] font-bold px-3 py-1.5 bg-white border border-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Input Area */}
                <div className="absolute bottom-24 left-6 right-6 flex gap-2">
                  <input 
                    type="text" 
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Hỏi AI về chi tiêu của bạn..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button 
                    onClick={() => handleSendMessage()}
                    className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors"
                  >
                    <Send size={20} />
                  </button>
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
                <h2 className="text-lg font-bold text-slate-900">Lịch sử giao dịch</h2>
                <div className="space-y-4">
                  {transactions.map((tx) => {
                    const category = MOCK_CATEGORIES.find(c => c.maDanhMuc === tx.maDanhMuc);
                    const Icon = CATEGORY_ICONS[tx.maDanhMuc] || MoreHorizontal;
                    return (
                      <div key={tx.maGiaoDich} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                            style={{ backgroundColor: category?.mauSac }}
                          >
                            <Icon size={22} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{tx.moTa}</p>
                            <p className="text-xs text-slate-400">{new Date(tx.ngayThucHien).toLocaleDateString('vi-VN')}</p>
                          </div>
                        </div>
                        <p className="text-base font-bold text-slate-900">-{tx.soTien.toLocaleString()}đ</p>
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
          className="absolute bottom-28 right-6 w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-200 z-30 hover:scale-110 transition-transform active:scale-95"
        >
          <Plus size={28} />
        </button>

        {/* Bottom Navigation */}
        <nav className="h-20 bg-white border-t border-slate-100 flex items-center justify-around px-4 absolute bottom-0 left-0 right-0 z-40">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'home' ? "text-indigo-600" : "text-slate-400")}
          >
            <Wallet size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ví</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'history' ? "text-indigo-600" : "text-slate-400")}
          >
            <History size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Lịch sử</span>
          </button>
          <div className="w-12" /> {/* Space for FAB */}
          <button 
            onClick={() => setActiveTab('ai')}
            className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'ai' ? "text-indigo-600" : "text-slate-400")}
          >
            <BrainCircuit size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">AI Brain</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'profile' ? "text-indigo-600" : "text-slate-400")}
          >
            <User size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Tôi</span>
          </button>
        </nav>

        {/* Add Transaction Modal Simulation */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end"
            >
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="w-full bg-white rounded-t-[2.5rem] p-8 space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">Thêm giao dịch</h2>
                  <button onClick={() => setShowAddModal(false)} className="text-slate-400 font-bold">Đóng</button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nhập tự nhiên (AI sẽ tự hiểu)</label>
                    <input 
                      type="text" 
                      value={rawInput}
                      onChange={(e) => setRawInput(e.target.value)}
                      placeholder="Ví dụ: Ăn bún chả 50k"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      autoFocus
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTransaction()}
                    />
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <BrainCircuit size={12} /> Não 1 (AI Phân Loại) sẽ xử lý dữ liệu này
                    </p>
                  </div>
                  <button 
                    onClick={handleAddTransaction}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} />
                    Xác nhận giao dịch
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
