# Roadmap: Chạy ứng dụng trên Expo Go

Để chuyển đổi mã nguồn mô phỏng này sang ứng dụng React Native thực thụ chạy trên điện thoại, hãy làm theo các bước sau:

## Bước 1: Khởi tạo dự án Expo
Mở terminal và chạy lệnh:
```bash
npx create-expo-app FinBrainApp --template tabs
cd FinBrainApp
```

## Bước 2: Cài đặt các thư viện cần thiết
Cài đặt các thư viện tương đương với phiên bản React Native:
```bash
npx expo install lucide-react-native react-native-svg react-native-reanimated react-native-chart-kit date-fns
```

## Bước 3: Di chuyển mã nguồn
1. Sao chép các file `src/types.ts`, `src/mockData.ts`, và `src/services/aiService.ts` vào thư mục dự án Expo.
2. Chỉnh sửa `src/App.tsx`:
   - Thay thế các thẻ HTML (`div`, `span`, `h1`, `p`) bằng các component của React Native (`View`, `Text`, `SafeAreaView`, `ScrollView`).
   - Thay thế Tailwind CSS (nếu không dùng thư viện `nativewind`) bằng `StyleSheet.create`.
   - Cập nhật các icon từ `lucide-react` sang `lucide-react-native`.

## Bước 4: Chạy ứng dụng
1. Khởi động server Expo:
   ```bash
   npx expo start
   ```
2. Tải ứng dụng **Expo Go** trên App Store hoặc Google Play.
3. Quét mã QR hiển thị trên terminal bằng camera điện thoại (iOS) hoặc ứng dụng Expo Go (Android).

## Lưu ý về Kiến trúc AI
Trong phiên bản thực tế, các module `aiPhanLoai`, `aiBoNaoPhanTich`, và `aiBoNaoHoiThoai` nên được triển khai trên Backend (Node.js/Python) và gọi qua API để đảm bảo hiệu năng và bảo mật mô hình.
