import { DanhMucChiTieu, GiaoDich, NganSach, NguoiDung } from './types';

export const MOCK_USER: NguoiDung = {
  maNguoiDung: 1,
  ten: "Nguyễn Văn A",
  email: "vana@example.com",
  matKhau: "********",
  ngayTao: new Date('2024-01-01'),
};

export const MOCK_CATEGORIES: DanhMucChiTieu[] = [
  { maDanhMuc: 'AN_UONG', tenDanhMuc: 'Ăn uống', moTaChiTiet: 'Chi phí ăn uống hàng ngày', mauSac: '#FF6B6B', bieuTuong: 'Utensils' },
  { maDanhMuc: 'DI_LAI', tenDanhMuc: 'Di lại', moTaChiTiet: 'Xăng xe, grab, taxi', mauSac: '#4D96FF', bieuTuong: 'Car' },
  { maDanhMuc: 'NHA_CUA', tenDanhMuc: 'Nhà cửa', moTaChiTiet: 'Tiền điện, nước, internet', mauSac: '#6BCB77', bieuTuong: 'Home' },
  { maDanhMuc: 'GIAI_TRI', tenDanhMuc: 'Giải trí', moTaChiTiet: 'Xem phim, du lịch', mauSac: '#FFD93D', bieuTuong: 'Gamepad2' },
  { maDanhMuc: 'KHAC', tenDanhMuc: 'Khác', moTaChiTiet: 'Các chi phí không tên', mauSac: '#95A5A6', bieuTuong: 'MoreHorizontal' },
];

export const MOCK_TRANSACTIONS: GiaoDich[] = [
  { maGiaoDich: 1, soTien: 50000, ngayThucHien: new Date('2024-03-01T08:30:00'), moTa: 'Ăn sáng phở bò', ghiChu: '', daXacNhan: true, maDanhMuc: 'AN_UONG' },
  { maGiaoDich: 2, soTien: 200000, ngayThucHien: new Date('2024-03-01T12:00:00'), moTa: 'Đổ xăng xe máy', ghiChu: 'Đầy bình', daXacNhan: true, maDanhMuc: 'DI_LAI' },
  { maGiaoDich: 3, soTien: 1500000, ngayThucHien: new Date('2024-03-01T15:00:00'), moTa: 'Mua giày mới', ghiChu: 'Nike sale', daXacNhan: true, maDanhMuc: 'GIAI_TRI' },
  { maGiaoDich: 4, soTien: 30000, ngayThucHien: new Date('2024-03-02T09:00:00'), moTa: 'Cà phê sáng', ghiChu: '', daXacNhan: true, maDanhMuc: 'AN_UONG' },
  { maGiaoDich: 5, soTien: 500000, ngayThucHien: new Date('2024-03-02T18:30:00'), moTa: 'Tiền điện tháng 2', ghiChu: '', daXacNhan: true, maDanhMuc: 'NHA_CUA' },
];

export const MOCK_BUDGETS: NganSach[] = [
  { maNganSach: 1, tenNganSach: 'Ăn uống tháng 3', soTienGioiHan: 3000000, soTienDaXai: 80000, ngayBatDau: new Date('2024-03-01'), ngayKetThuc: new Date('2024-03-31') },
  { maNganSach: 2, tenNganSach: 'Di lại tháng 3', soTienGioiHan: 1000000, soTienDaXai: 200000, ngayBatDau: new Date('2024-03-01'), ngayKetThuc: new Date('2024-03-31') },
];
