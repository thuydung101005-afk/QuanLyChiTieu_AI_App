import requests
import time

def main():
    print("=== BẮT ĐẦU KIỂM THỬ GLOBAL CONCEPT & AUTO-LEARNING ===")
    
    print("\n1. Test /predict với câu CHƯA TỪNG HỌC (nên ra GIAO_DICH_KHAC hoặc tự fallback Gemini)")
    test_sentence = "đổ mỡ bò 50k" # Cố tình nói rất lóng
    
    try:
        resp = requests.post("http://127.0.0.1:8000/predict", json={"text": test_sentence})
        result1 = resp.json()
        print(f" -> Kết quả ban đầu: {result1}")
    except Exception as e:
        print(f"Lỗi gọi AI: {e}. Vui lòng đảm bảo python ai_service.py đang chạy.")
        return

    print("\n2. Giả lập Người dùng vào App SỬA thành nhóm THIET_YEU...")
    try:
        resp = requests.post("http://127.0.0.1:8000/learn", json={
            "text": test_sentence,
            "concept": "THIET_YEU"
        })
        print(f" -> Gọi /learn thành công: {resp.json()}")
    except Exception as e:
        print(f"Lỗi gọi /learn: {e}")
        return
        
    wait_secs = 60
    print(f"\n3. Chờ {wait_secs} giây để Model tự train ngầm (background task)...")
    for i in range(wait_secs):
        bar = "█" * (i + 1) + "░" * (wait_secs - i - 1)
        print(f"\r   [{bar}] {i+1}/{wait_secs}s", end="", flush=True)
        time.sleep(1)
    print()
    
    print("\n4. Thử check lại chính câu đó xem AI nhớ chưa...")
    try:
        resp = requests.post("http://127.0.0.1:8000/predict", json={"text": test_sentence})
        result2 = resp.json()
        print(f" -> MỚI NÈ: Lần 2 phân loại tự động thành (không cần LLM):")
        print(f"    Concept: {result2.get('predicted_concept')} - Tự tin: {result2.get('confidence_score')} - Cầu cứu Gemini: {result2.get('used_fallback')}")
        
        if result2.get('predicted_concept') == "THIET_YEU" and not result2.get('used_fallback'):
            print("\n🎉 BÙM!!! AUTO-LEARNING HOẠT ĐỘNG HOÀN HẢO!")
        else:
            print("\n❌ Cơ chế tự học bị rớt mất rồi.")
    except Exception as e:
        print(f"Lỗi gọi AI lần 2: {e}")

if __name__ == "__main__":
    main()
