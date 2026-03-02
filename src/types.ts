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

// AI Module Interfaces
export interface AIPhanLoai {
  moHinhML: string;
  mucDoTinCay: number;
  phanLoaiGiaoDich: (moTa: string) => string;
}

export interface AIBoNaoPhanTich {
  phanTichChiTieu: (giaoDichs: GiaoDich[]) => any;
  timBatThuong: (giaoDichs: GiaoDich[]) => KiemVuong[];
  tinhXuHuong: (giaoDichs: GiaoDich[]) => any;
}

export interface AIBoNaoHoiThoai {
  xuLyTinNhan: (tinNhan: string) => TraLoiAI;
  taoLoiKhuyen: (kiemVuongs: KiemVuong[]) => string;
}
