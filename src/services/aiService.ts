import { GiaoDich, KiemVuong, TraLoiAI, AIPhanLoai, AIBoNaoPhanTich, AIBoNaoHoiThoai, KetQuaPhanLoai, Insight, NganSach } from '../types';

// 1. Tầng Phân Loại (Perception Layer) - Người gác cổng
export const aiPhanLoai: AIPhanLoai = {
  moHinhML: "BERT-Finance-v1",
  mucDoTinCay: 0.92,
  xuLyDuLieuTho: (rawInput: string): KetQuaPhanLoai | null => {
    // Regex to extract amount (e.g., 50k, 50000, 50.000)
    const amountMatch = rawInput.match(/(\d+)(k|K|000)?/);
    if (!amountMatch) return null;

    let amount = parseInt(amountMatch[1], 10);
    if (amountMatch[2] && amountMatch[2].toLowerCase() === 'k') {
      amount *= 1000;
    } else if (amount < 1000) {
      // Assume if user types "50" they mean 50,000 in VND context
      amount *= 1000; 
    }

    const desc = rawInput.replace(amountMatch[0], '').trim();
    const descLower = desc.toLowerCase();

    let category = 'KHAC';
    if (descLower.includes('ăn') || descLower.includes('uống') || descLower.includes('phở') || descLower.includes('cơm') || descLower.includes('cafe')) category = 'AN_UONG';
    else if (descLower.includes('xe') || descLower.includes('xăng') || descLower.includes('grab') || descLower.includes('taxi')) category = 'DI_LAI';
    else if (descLower.includes('điện') || descLower.includes('nước') || descLower.includes('nhà') || descLower.includes('internet')) category = 'NHA_CUA';
    else if (descLower.includes('phim') || descLower.includes('chơi') || descLower.includes('giày') || descLower.includes('du lịch')) category = 'GIAI_TRI';

    return {
      moTa: desc || 'Giao dịch mới',
      soTien: amount,
      maDanhMuc: category,
      mucDoTinCay: 0.95
    };
  }
};

// 2. Tầng Phân Tích (Analytical Layer) - Nhà khoa học dữ liệu
export const aiBoNaoPhanTich: AIBoNaoPhanTich = {
  phanTichChiTieu: (giaoDichs: GiaoDich[]) => {
    const summary: Record<string, number> = {};
    giaoDichs.forEach(g => {
      summary[g.maDanhMuc] = (summary[g.maDanhMuc] || 0) + g.soTien;
    });
    return Object.entries(summary).map(([ma, value]) => ({ name: ma, value }));
  },
  timBatThuong: (giaoDichs: GiaoDich[]) => {
    const anomalies: KiemVuong[] = [];
    if (giaoDichs.length === 0) return anomalies;
    const avg = giaoDichs.reduce((acc, g) => acc + g.soTien, 0) / giaoDichs.length;
    
    giaoDichs.forEach(g => {
      if (g.soTien > avg * 3) {
        anomalies.push({
          tieuDe: "Chi tiêu bất thường",
          moTa: `Giao dịch "${g.moTa}" (${g.soTien.toLocaleString()}đ) cao gấp 3 lần trung bình.`,
          mucDoNghiemTrong: 4,
          deXuatHanhDong: ["Xem lại hóa đơn", "Phân bổ lại ngân sách dự phòng"]
        });
      }
    });
    return anomalies;
  },
  taoInsights: (giaoDichs: GiaoDich[], nganSachs: NganSach[]): Insight[] => {
    const insights: Insight[] = [];
    
    // Check budget
    const totalSpent = giaoDichs.reduce((acc, g) => acc + g.soTien, 0);
    const totalBudget = nganSachs.reduce((acc, b) => acc + b.soTienGioiHan, 0);
    
    if (totalSpent > totalBudget * 0.8) {
      insights.push({
        type: 'budget_warning',
        data: { spent: totalSpent, budget: totalBudget, ratio: totalSpent / totalBudget }
      });
    }

    // Check anomalies
    const anomalies = aiBoNaoPhanTich.timBatThuong(giaoDichs);
    if (anomalies.length > 0) {
      insights.push({
        type: 'anomaly_detected',
        data: { anomalies }
      });
    }

    // General summary
    insights.push({
      type: 'general_summary',
      data: { totalSpent, count: giaoDichs.length }
    });

    return insights;
  }
};

// 3. Tầng Hội Thoại (Conversational Layer) - Người phát ngôn
export const aiBoNaoHoiThoai: AIBoNaoHoiThoai = {
  dienGiaiInsight: (insight: Insight): TraLoiAI => {
    switch (insight.type) {
      case 'budget_warning':
        return {
          noiDung: `Cảnh báo: Bạn đã tiêu ${(insight.data.spent).toLocaleString()}đ, đạt ${Math.round(insight.data.ratio * 100)}% ngân sách tháng. Hãy cẩn thận với các khoản chi sắp tới!`,
          deXuatHanhDong: ["Xem chi tiết hạng mục", "Cắt giảm chi tiêu không cần thiết"],
          cauHoiTiepTheo: ["Hạng mục nào đang tốn kém nhất?", "Làm sao để tiết kiệm?"],
          mucDoTinCay: 0.98
        };
      case 'anomaly_detected':
        const anomaly = insight.data.anomalies[0];
        return {
          noiDung: `Tôi phát hiện một khoản chi bất thường: ${anomaly.moTa}. Bạn có muốn xem lại không?`,
          deXuatHanhDong: anomaly.deXuatHanhDong,
          cauHoiTiepTheo: ["Tại sao khoản này lại bất thường?", "Bỏ qua cảnh báo này"],
          mucDoTinCay: 0.95
        };
      case 'general_summary':
        return {
          noiDung: `Tổng quan: Bạn đã thực hiện ${insight.data.count} giao dịch với tổng số tiền ${(insight.data.totalSpent).toLocaleString()}đ.`,
          deXuatHanhDong: ["Xem biểu đồ phân tích"],
          cauHoiTiepTheo: ["Dự báo chi tiêu tuần tới", "So sánh với tháng trước"],
          mucDoTinCay: 1.0
        };
      default:
        return {
          noiDung: "Mọi thứ đang trong tầm kiểm soát.",
          deXuatHanhDong: [],
          cauHoiTiepTheo: [],
          mucDoTinCay: 1.0
        };
    }
  },
  xuLyTinNhan: (tinNhan: string, currentInsights: Insight[]): TraLoiAI => {
    const msg = tinNhan.toLowerCase();
    if (msg.includes('tổng chi') || msg.includes('tổng quan')) {
      const summaryInsight = currentInsights.find(i => i.type === 'general_summary');
      if (summaryInsight) return aiBoNaoHoiThoai.dienGiaiInsight(summaryInsight);
    }
    if (msg.includes('vượt ngân sách') || msg.includes('ngân sách')) {
      const budgetInsight = currentInsights.find(i => i.type === 'budget_warning');
      if (budgetInsight) return aiBoNaoHoiThoai.dienGiaiInsight(budgetInsight);
      return {
        noiDung: "Bạn vẫn đang chi tiêu an toàn trong ngân sách. Tuyệt vời!",
        deXuatHanhDong: [],
        cauHoiTiepTheo: ["Phân tích theo hạng mục giúp tôi"],
        mucDoTinCay: 0.95
      };
    }
    if (msg.includes('bất thường')) {
      const anomalyInsight = currentInsights.find(i => i.type === 'anomaly_detected');
      if (anomalyInsight) return aiBoNaoHoiThoai.dienGiaiInsight(anomalyInsight);
      return {
        noiDung: "Không có khoản chi tiêu nào bất thường gần đây.",
        deXuatHanhDong: [],
        cauHoiTiepTheo: [],
        mucDoTinCay: 0.95
      };
    }
    return {
      noiDung: "Chào bạn! Tôi là Người phát ngôn của Bộ não AI. Tôi đã nhận được các bản phân tích mới nhất từ hệ thống. Bạn muốn biết về tổng quan chi tiêu, hay kiểm tra các cảnh báo ngân sách?",
      deXuatHanhDong: ["Xem tổng quan", "Kiểm tra ngân sách"],
      cauHoiTiepTheo: ["Có khoản chi nào bất thường không?"],
      mucDoTinCay: 1.0
    };
  }
};
