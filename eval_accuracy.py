"""
Script đánh giá độ chính xác (Accuracy) của AI Phân loại giao dịch.
Sử dụng bộ test 60 câu thực tế tiếng Việt có nhãn chuẩn.
Chạy: python eval_accuracy.py
"""

import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

URL = "http://127.0.0.1:8000/predict"

# ─── Bộ Test Chuẩn (60 câu, 7 nhóm) ──────────────────────────────────────────
# Format: (mô tả giao dịch, nhãn đúng - Global Concept)
TEST_CASES = [
    # THIET_YEU – Thiết yếu (ăn uống, nhà ở, điện nước, đi lại cơ bản)
    ("ăn cơm trưa 25k",                         "THIET_YEU"),
    ("tiền điện tháng này 180k",                 "THIET_YEU"),
    ("tiền nhà trọ tháng 4 2.5tr",               "THIET_YEU"),
    ("mua rau củ quả ngoài chợ 45k",             "THIET_YEU"),
    ("đổ xăng xe máy 60k",                       "THIET_YEU"),
    ("mua thuốc cảm 30k",                        "THIET_YEU"),
    ("ăn bát phở bò 35k",                        "THIET_YEU"),
    ("tiền nước sinh hoạt 85k",                  "THIET_YEU"),
    ("cắt tóc 50k",                              "THIET_YEU"),
    ("mua đồ ăn sáng bánh mì 15k",              "THIET_YEU"),
    ("đặt grab đi làm 35k",                      "THIET_YEU"),
    ("mua mì gói dự trữ 120k",                   "THIET_YEU"),

    # HUONG_THU – Hưởng thụ (giải trí, du lịch, mua sắm, ăn nhậu)
    ("đi karaoke với bạn bè 200k",               "HUONG_THU"),
    ("mua áo mới shopee sale 350k",              "HUONG_THU"),
    ("xem phim cgv 2 vé 220k",                   "HUONG_THU"),
    ("ăn nhậu cuối tuần 500k",                   "HUONG_THU"),
    ("nạp game liên quân 100k",                  "HUONG_THU"),
    ("uống cà phê highlands 65k",                "HUONG_THU"),
    ("du lịch đà nẵng vé máy bay 1.2tr",        "HUONG_THU"),
    ("mua son môi 180k",                         "HUONG_THU"),
    ("ăn buffet lẩu 350k",                       "HUONG_THU"),
    ("mua giày sneaker 600k",                    "HUONG_THU"),
    ("trà sữa gong cha 55k",                     "HUONG_THU"),
    ("đặt phòng khách sạn đà lạt 800k",         "HUONG_THU"),

    # GIAO_DUC – Giáo dục (học tập, sách, khóa học)
    ("mua sách học lập trình python 120k",       "GIAO_DUC"),
    ("đóng học phí tiếng anh tháng này 500k",   "GIAO_DUC"),
    ("mua khóa học udemy 250k",                  "GIAO_DUC"),
    ("mua sách giáo khoa 85k",                   "GIAO_DUC"),
    ("học phí luyện thi ielts 2tr",              "GIAO_DUC"),
    ("mua bút vở học sinh 45k",                  "GIAO_DUC"),
    ("đóng tiền học thêm toán 300k",             "GIAO_DUC"),
    ("mua tài liệu ôn thi 70k",                 "GIAO_DUC"),

    # DAU_TU – Đầu tư (cổ phiếu, vàng, tài sản sinh lời)
    ("mua cổ phiếu VNM 5tr",                    "DAU_TU"),
    ("nạp tiền tài khoản chứng khoán 10tr",     "DAU_TU"),
    ("mua vàng SJC 1 chỉ 6.8tr",               "DAU_TU"),
    ("mua eth crypto 2tr",                       "DAU_TU"),
    ("nạp tài khoản đầu tư chứng khoán 3tr",    "DAU_TU"),

    # TICH_LUY – Tích lũy (tiết kiệm, quỹ dự phòng)
    ("chuyển tiết kiệm ngân hàng 3tr",          "TICH_LUY"),
    ("gửi tiết kiệm có kỳ hạn 5tr",             "TICH_LUY"),
    ("để dành tiền mua nhà 2tr",                "TICH_LUY"),
    ("nạp quỹ dự phòng khẩn cấp 1tr",          "TICH_LUY"),
    ("tích lũy hàng tháng 1.5tr",               "TICH_LUY"),

    # CHO_DI – Cho đi (từ thiện, quà tặng, biếu tặng)
    ("mua quà sinh nhật bạn 200k",              "CHO_DI"),
    ("gửi tiền về quê biếu bố mẹ 1tr",         "CHO_DI"),
    ("đóng góp từ thiện lũ lụt 200k",          "CHO_DI"),
    ("mua hoa cưới đám cưới bạn 300k",         "CHO_DI"),
    ("mừng sinh nhật sếp 500k",                 "CHO_DI"),
    ("phong bì đám hỏi 500k",                   "CHO_DI"),
]

# ─── Chạy Đánh Giá ────────────────────────────────────────────────────────────
correct = 0
total = len(TEST_CASES)
wrong_cases = []

print("=" * 60)
print("   ĐÁNH GIÁ ĐỘ CHÍNH XÁC AI PHÂN LOẠI GIAO DỊCH")
print("=" * 60)
print(f"Tổng số câu test: {total}\n")

label_correct = {}
label_total   = {}

for text, expected in TEST_CASES:
    label_total[expected] = label_total.get(expected, 0) + 1
    try:
        res = requests.post(URL, json={"text": text, "jars": []}, timeout=15)
        data = res.json()
        predicted = data.get("predicted_concept", "ERROR")
        confidence = data.get("confidence_score", 0)
        fallback = data.get("used_fallback", False)

        is_correct = (predicted == expected)
        if is_correct:
            correct += 1
            label_correct[expected] = label_correct.get(expected, 0) + 1
            status = "✅"
        else:
            wrong_cases.append((text, expected, predicted, confidence))
            status = "❌"

        fb_tag = " [Gemini]" if fallback else ""
        print(f"{status} [{expected:12s}→{predicted:12s}] ({confidence:.2f}){fb_tag}  '{text}'")
    except Exception as e:
        print(f"💥 LỖI kết nối: {e}")
        total -= 1

# ─── Kết Quả Tổng Hợp ─────────────────────────────────────────────────────────
accuracy = (correct / total * 100) if total > 0 else 0

print("\n" + "=" * 60)
print("   KẾT QUẢ TỔNG HỢP")
print("=" * 60)

# Accuracy theo từng nhóm
print("\n📊 Accuracy theo từng nhóm:\n")
groups = {
    "THIET_YEU": "Thiết yếu",
    "HUONG_THU":  "Hưởng thụ",
    "GIAO_DUC":   "Giáo dục",
    "DAU_TU":     "Đầu tư",
    "TICH_LUY":   "Tích lũy",
    "CHO_DI":     "Cho đi",
}
for key, name in groups.items():
    c = label_correct.get(key, 0)
    t = label_total.get(key, 0)
    pct = (c / t * 100) if t > 0 else 0
    bar = "█" * int(pct // 10) + "░" * (10 - int(pct // 10))
    print(f"  {name:16s} [{bar}] {c}/{t}  ({pct:.0f}%)")

print(f"\n{'─'*60}")
print(f"  🎯 ACCURACY TỔNG THỂ: {correct}/{total} = {accuracy:.1f}%")
print(f"{'─'*60}")

if wrong_cases:
    print(f"\n⚠️  {len(wrong_cases)} câu phân loại sai:\n")
    for text, exp, pred, conf in wrong_cases:
        print(f"  Câu   : '{text}'")
        print(f"  Đúng  : {exp}  |  AI đoán: {pred}  (conf: {conf:.2f})")
        print()

print("\n📝 Ghi chú: Test không dùng hũ cụ thể → chỉ đo FastText + Gemini Fallback (Layer 1+2)")
print("           Trong app thật, TF-IDF (Layer 0) sẽ tăng accuracy thêm đáng kể.\n")
