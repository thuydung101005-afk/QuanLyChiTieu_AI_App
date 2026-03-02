import { GiaoDich, KiemVuong, TraLoiAI, AIPhanLoai, AIBoNaoPhanTich, AIBoNaoHoiThoai } from '../types';

// 1. Tầng Phân Loại (Perception Layer)
export const aiPhanLoai: AIPhanLoai = {
  moHinhML: "BERT-Finance-v1",
  mucDoTinCay: 0.92,
  phanLoaiGiaoDich: (moTa: string) => {
    const desc = moTa.toLowerCase();
    if (desc.includes('ăn') || desc.includes('uống') || desc.includes('phở') || desc.includes('cơm')) return 'AN_UONG';
    if (desc.includes('xe') || desc.includes('xăng') || desc.includes('grab') || desc.includes('taxi')) return 'DI_LAI';
    if (desc.includes('điện') || desc.includes('nước') || desc.includes('nhà') || desc.includes('internet')) return 'NHA_CUA';
    if (desc.includes('phim') || desc.includes('chơi') || desc.includes('giày') || desc.includes('du lịch')) return 'GIAI_TRI';
    return 'KHAC';
  }
};

// 2. Tầng Phân Tích (Analytical Layer)
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
  tinhXuHuong: (giaoDichs: GiaoDich[]) => {
    // Giả lập tính xu hướng
    return [
      { date: '01/03', amount: 1750000 },
      { date: '02/03', amount: 530000 },
    ];
  }
};

// 3. Tầng Hội Thoại (Conversational Layer)
export const aiBoNaoHoiThoai: AIBoNaoHoiThoai = {
  xuLyTinNhan: (tinNhan: string): TraLoiAI => {
    const msg = tinNhan.toLowerCase();
    if (msg.includes('tổng chi')) {
      return {
        noiDung: "Tổng chi tiêu của bạn trong 2 ngày qua là 2.280.000đ.",
        deXuatHanhDong: ["Xem báo cáo chi tiết", "Thiết lập ngân sách mới"],
        cauHoiTiepTheo: ["Tôi có đang vượt ngân sách không?", "Phân tích theo hạng mục giúp tôi"],
        mucDoTinCay: 0.98
      };
    }
    if (msg.includes('vượt ngân sách')) {
      return {
        noiDung: "Bạn đang chi tiêu 80.000đ cho Ăn uống, vẫn còn 2.920.000đ trong hạn mức tháng này. Tuy nhiên, mục Giải trí đã dùng 1.500.000đ, hãy cẩn thận!",
        deXuatHanhDong: ["Cắt giảm chi tiêu giải trí"],
        cauHoiTiepTheo: ["Làm sao để tiết kiệm hơn?"],
        mucDoTinCay: 0.95
      };
    }
    return {
      noiDung: "Chào bạn! Tôi là Bộ não AI tài chính của bạn. Tôi có thể giúp bạn phân loại giao dịch, phân tích xu hướng và đưa ra lời khuyên tiết kiệm.",
      deXuatHanhDong: ["Thêm giao dịch mới", "Xem phân tích chi tiêu"],
      cauHoiTiepTheo: ["Hôm nay tôi đã tiêu bao nhiêu?", "Dự báo chi tiêu tháng này"],
      mucDoTinCay: 1.0
    };
  },
  taoLoiKhuyen: (kiemVuongs: KiemVuong[]) => {
    if (kiemVuongs.length > 0) {
      return `Tôi phát hiện ${kiemVuongs.length} vấn đề cần lưu ý. Đáng chú ý nhất là: ${kiemVuongs[0].moTa}`;
    }
    return "Tình hình tài chính của bạn đang rất ổn định. Hãy tiếp tục duy trì thói quen ghi chép này nhé!";
  }
};
