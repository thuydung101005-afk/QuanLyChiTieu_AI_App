import sys
import os

# Đảm bảo có thể import ai_service
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_service import extract_name, parse_amount

test_cases_name = [
    # Tên có số, không bị xóa
    ("Uống trà sữa 1986 giá 50k", "Uống trà sữa 1986 giá"),
    ("Mua đồ ở cửa hàng 24h mất 100k", "Mua đồ ở cửa hàng 24h mất"),
    ("Mua giày Bitis Hunter số 43 giá 1tr2", "Mua giày Bitis Hunter số 43 giá"),
    
    # Định dạng tiền chuẩn
    ("Ăn sáng 30000", "Ăn sáng"),
    ("Ăn trưa 50.000", "Ăn trưa"),
    ("Tiền điện 1.500.000", "Tiền điện"),
    
    # Text nhiều loại tiền
    ("Đi chợ mua thịt bò 200k và rau 50k", "Đi chợ mua thịt bò và rau"),
    
    # Đơn vị tiền lóng
    ("Đóng học phí cho con 5tr", "Đóng học phí cho con"),
    ("Nạp game 361 cành", "Nạp game"),
    ("Bơm xe 10 c", "Bơm xe"),
]

test_cases_amount = [
    ("Uống trà sữa 1986 giá 50k", 50000.0),
    ("Ăn sáng 30000", 30000.0),
    ("Tiền điện 1.500.000", 1500000.0),
    ("Mua giày Bitis Hunter số 43 giá 1tr2", 1200000.0),
    # Test case quan trọng: Cộng gộp nhiều tiền
    ("Đi chợ mua thịt bò 200k và rau 50k", 250000.0),
    ("Nạp thẻ 50k và 100000", 150000.0),
    ("Chi tiêu linh tinh 2 củ 5", 2500000.0), # dạng viết tắt đã được tiền xử lý
]

print("--- 1. KIỂM TRA REGEX TÁCH TÊN GIAO DỊCH ---")
success = True
for i, (text, expected) in enumerate(test_cases_name, 1):
    result = extract_name(text)
    if result != expected:
        print(f"❌ Fail Name {i}:\n   Input:    '{text}'\n   Expected: '{expected}'\n   Got:      '{result}'")
        success = False

print("\n--- 2. KIỂM TRA PARSE SỐ TIỀN & CỘNG GỘP ---")
for i, (text, expected) in enumerate(test_cases_amount, 1):
    result = parse_amount(text)
    if result != expected:
        print(f"❌ Fail Amount {i}:\n   Input:    '{text}'\n   Expected: {expected}\n   Got:      {result}")
        success = False

if success:
    print("\n🚀 TẤT CẢ TEST CASES ĐỀU PASS! Regex mới an toàn phân tách và tính tổng chính xác.")
else:
    print("\n⚠️ CÓ LỖI XẨY RA, CẦN CHỈNH SỬA THÊM REGEX.")
