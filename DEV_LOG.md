# Dev Log: Kiến trúc AI Bộ não Ba tầng (Three-Layer Brain)

## 1. Tổng quan
Hệ thống được thiết kế dựa trên mô hình xử lý thông tin phân tầng, giúp ứng dụng không chỉ là công cụ ghi chép mà còn là một trợ lý tài chính thông minh.

## 2. Các tầng kiến trúc (Layers)

### Tầng 1: Phân loại & Nhận diện (Perception Layer - AIPhanLoai)
- **Nhiệm vụ:** Chuyển đổi dữ liệu thô (văn bản nhập từ người dùng) thành dữ liệu có cấu trúc.
- **Cơ chế:** Sử dụng mô hình xử lý ngôn ngữ tự nhiên (NLP) để gán nhãn danh mục (Category) cho mỗi giao dịch dựa trên mô tả.
- **Lợi ích:** Giảm bớt thao tác thủ công cho người dùng, tăng độ chính xác của báo cáo.

### Tầng 2: Phân tích & Suy luận (Analytical Layer - AIBoNaoPhanTich)
- **Nhiệm vụ:** Tìm kiếm các mẫu (patterns), xu hướng (trends) và các điểm bất thường (anomalies) trong dữ liệu lịch sử.
- **Cơ chế:** 
  - Tính toán tổng chi tiêu theo hạng mục.
  - So sánh chi tiêu hiện tại với mức trung bình hoặc hạn mức ngân sách.
  - Phát hiện các giao dịch "đột biến" (KiemVuong).
- **Lợi ích:** Cung cấp cái nhìn sâu sắc về thói quen chi tiêu mà người dùng khó tự nhận ra.

### Tầng 3: Hội thoại & Tương tác (Conversational Layer - AIBoNaoHoiThoai)
- **Nhiệm vụ:** Giao tiếp với người dùng bằng ngôn ngữ tự nhiên, giải thích các phân tích phức tạp một cách dễ hiểu.
- **Cơ chế:** 
  - Tiếp nhận câu hỏi từ người dùng.
  - Truy vấn dữ liệu từ Tầng 2 để trả lời.
  - Đưa ra các lời khuyên (LoiKhuyen) và đề xuất hành động (DeXuatHanhDong).
- **Lợi ích:** Tạo ra trải nghiệm cá nhân hóa, giúp người dùng cảm thấy có một chuyên gia tài chính đồng hành.

## 3. Cấu trúc dữ liệu chính
- `NguoiDung`: Thông tin tài khoản.
- `GiaoDich`: Đơn vị dữ liệu cơ bản, được Tầng 1 xử lý.
- `NganSach`: Mục tiêu tài chính, được Tầng 2 giám sát.
- `KiemVuong`: Các vấn đề/cảnh báo được Tầng 2 phát hiện.
- `TraLoiAI`: Kết quả đầu ra của Tầng 3.
