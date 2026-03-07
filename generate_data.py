import os
import argparse
from dotenv import load_dotenv
from google import genai

load_dotenv()

# Danh sách các Global Concept cốt lõi
CATEGORIES = [
    "THIET_YEU",
    "HUONG_THU",
    "GIAO_DUC",
    "DAU_TU",
    "TICH_LUY",
    "CHO_DI",
    "GIAO_DICH_KHAC"
]

def generate_training_data(api_key: str, num_examples_per_cat: int = 50, output_file: str = "training_data.txt"):
    """
    Sử dụng Gemini để sinh dữ liệu huấn luyện FastText.
    """
    client = genai.Client(api_key=api_key)
    model = "gemini-2.5-flash"

    print(f"🚀 Bắt đầu sinh {num_examples_per_cat} mẫu câu cho mỗi danh mục bằng model {model}...")

    generated_lines = []

    for cat in CATEGORIES:
        print(f"⏳ Đang sinh dữ liệu cho danh mục: {cat}...")
        prompt = f"""Bạn là một chuyên gia tạo dữ liệu huấn luyện AI phân loại chi tiêu cá nhân bằng tiếng Việt.
Hãy tạo ra ĐÚNG {num_examples_per_cat} dòng văn bản mô tả các giao dịch chi tiêu/thu nhập thuộc danh mục "{cat}".

Yêu cầu bắt buộc:
1. Đa dạng hóa từ vựng: dùng phương ngữ (Bắc, Trung, Nam), từ lóng mạng (vd: ck, rổ giá, chốt đơn, dứa, cành, củ), viết tắt (vd: vs, tr, k).
2. Đa dạng hóa số tiền: có thể có số tiền hoặc không có số tiền (vd: "mua rau 30k", "tiền điện tháng này"). Nếu có số tiền, hãy dùng nhiều cách viết (50k, 50.000, 50 cành, 2 củ, 1tr5).
3. Đa dạng cấu trúc: ngắn ("đổ xăng"), dài ("chuyển khoản trả tiền ăn trưa hôm qua cho con bạn").
4. MỖI DÒNG BẮT ĐẦU BẰNG ĐÚNG CHUỖI NÀY: __label__{cat} [Khoảng cách] [Câu văn của bạn]
5. KHÔNG đánh số thứ tự đầu dòng. KHÔNG in đậm. KHÔNG giải thích. CHỈ trả về dữ liệu thô.

Ví dụ định dạng đầu ra chuẩn mà bạn PHẢI tuân thủ:
__label__{cat} Mua ly trà sữa trân châu hoàng kim size L 55k
__label__{cat} ck tiền mượn tháng trước 2 củ
__label__{cat} đổi bình nước lọc 15k
"""

        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.8,
                )
            )
            
            # Xử lý văn bản trả về
            text = response.text.strip()
            lines = text.split('\n')
            
            valid_count = 0
            for line in lines:
                line = line.strip()
                if line.startswith(f"__label__{cat}"):
                    # Loại bỏ các ký tự thừa như dấu gạch đầu dòng, sao chép nếu có
                    line = line.replace("*", "").replace("- ", "").strip()
                    generated_lines.append(line)
                    valid_count += 1
                    
            print(f"✅ Đã nhận được {valid_count} mẫu hợp lệ cho {cat}.")
            
        except Exception as e:
            print(f"❌ Lỗi khi sinh dữ liệu cho {cat}: {e}")

    # Ghi vào file (cộng thêm vào nếu file đã có)
    if generated_lines:
        mode = "a" if os.path.exists(output_file) else "w"
        with open(output_file, mode, encoding="utf-8") as f:
            for line in generated_lines:
                f.write(f"{line}\n")
        
        print(f"\n🎉 Hoàn tất! Đã lưu tổng cộng {len(generated_lines)} dòng vào file '{output_file}'.")
    else:
        print("\n⚠️ Không sinh được dữ liệu nào hợp lệ.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sinh dữ liệu huấn luyện FastText bằng Gemini")
    parser.add_argument("--count", type=int, default=30, help="Số lượng tin nhắn sinh ra cho mỗi danh mục")
    args = parser.parse_args()
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Lỗi: Không tìm thấy GEMINI_API_KEY trong file .env")
        exit(1)
        
    generate_training_data(api_key, num_examples_per_cat=args.count)
