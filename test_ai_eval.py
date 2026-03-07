import requests

test_cases = [
    # Thiết yếu
    "Ăn phở bò 45k",
    "Đóng tiền điện tháng 10 1tr5",
    "Đổ xăng 50k",
    "Mua rau thịt siêu thị 300k",
    
    # Hưởng thụ
    "Mua vé xem phim 200k",
    "Uống cafe trà sữa 60k",
    "Mua áo mới 500k",
    "Nạp game 50k",
    
    # Giáo dục
    "Mua sách tiếng Anh 300k",
    "Đóng học phí đại học 15 củ",
    "Khóa học lập trình 2 củ",
    
    # Đầu tư
    "Mua cổ phiếu HPG 10tr",
    "Mua 1 chỉ vàng 8tr",
    
    # Tích lũy
    "Gửi sổ tiết kiệm 20tr",
    "Bỏ ống heo 200k",
    
    # Cho đi
    "Đi đám cưới Tuấn 1 củ",
    "Biếu ba mẹ 2 triệu",
    "Quyên góp từ thiện 100k",
    
    # Edge cases / Lóng
    "Đổ mỡ bò 50k",
    "Bơm máu 500 cành"
]

print(f"{'Text':<30} | {'Extracted Amount':<20} | {'Name':<25} | {'Concept':<15} | {'Conf':<6} | {'Fallback'}")
print("-" * 115)

for text in test_cases:
    try:
        resp = requests.post("http://127.0.0.1:8000/predict", json={"text": text})
        data = resp.json()
        amount = str(data.get('extracted_amount'))
        name = data.get('extracted_name', '')[:20]
        concept = data.get('predicted_concept', '')
        conf = str(data.get('confidence_score'))
        fallback = 'Yes' if data.get('used_fallback') else 'No'
        print(f"{text:<30} | {amount:<20} | {name:<25} | {concept:<15} | {conf:<6} | {fallback}")
    except Exception as e:
        print(f"Error for '{text}': {e}")
