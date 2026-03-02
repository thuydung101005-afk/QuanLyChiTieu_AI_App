export interface NguoiDung {
  maNguoiDung: number;
  ten: string;
  email: string;
  matKhau: string;
  ngayTao: Date;
}

export interface DanhMucChiTieu {
  maDanhMuc: string;
  tenDanhMuc: string;
  moTaChiTiet: string;
  mauSac: string;
  bieuTuong: string;
}

export interface GiaoDich {
  maGiaoDich: number;
  soTien: number;
  ngayThucHien: Date;
  moTa: string;
  ghiChu: string;
  daXacNhan: boolean;
  maDanhMuc: string;
}

export interface NganSach {
  maNganSach: number;
  tenNganSach: string;
  soTienGioiHan: number;
  soTienDaXai: number;
  ngayBatDau: Date;
  ngayKetThuc: Date;
}

export interface KiemVuong {
  tieuDe: string;
  moTa: string;
  mucDoNghiemTrong: number; // 1-5
  deXuatHanhDong: string[];
}

export interface TraLoiAI {
  noiDung: string;
  deXuatHanhDong: string[];
  cauHoiTiepTheo: string[];
  mucDoTinCay: number;
}

export interface BaoCao {
  maBaoCao: number;
  tieuDe: string;
  noiDung: string;
  loaiBaoCao: 'THANG' | 'NAM' | 'DAC_BIET';
}

export interface ThongBao {
  maThongBao: number;
  tieuDe: string;
  noiDung: string;
  trangThai: 'MOI' | 'DA_DOC';
  thoiGianTao: Date;
}

export interface KetQuaPhanLoai {
  moTa: string;
  soTien: number;
  maDanhMuc: string;
  mucDoTinCay: number;
}

export interface Insight {
  type: 'budget_warning' | 'anomaly_detected' | 'trend_positive' | 'trend_negative' | 'general_summary';
  data: any;
}

// AI Module Interfaces
export interface AIPhanLoai {
  moHinhML: string;
  mucDoTinCay: number;
  xuLyDuLieuTho: (rawInput: string) => KetQuaPhanLoai | null;
}

export interface AIBoNaoPhanTich {
  phanTichChiTieu: (giaoDichs: GiaoDich[]) => any;
  timBatThuong: (giaoDichs: GiaoDich[]) => KiemVuong[];
  taoInsights: (giaoDichs: GiaoDich[], nganSachs: NganSach[]) => Insight[];
}

export interface AIBoNaoHoiThoai {
  dienGiaiInsight: (insight: Insight) => TraLoiAI;
  xuLyTinNhan: (tinNhan: string, currentInsights: Insight[]) => TraLoiAI;
}
