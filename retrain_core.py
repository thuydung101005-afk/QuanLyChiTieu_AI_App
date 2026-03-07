import fasttext
import os
import shutil

# Dữ liệu bổ sung tập trung vào các câu RẤT NGẮN, TỪ LÓNG, MẤT NGỮ CẢNH
# Cấu trúc: __label__CONCEPT nội dung
extra_data = [
    # --- THIẾT YẾU ---
    "__label__THIET_YEU phở bò", "__label__THIET_YEU bún chả", "__label__THIET_YEU bánh mì",
    "__label__THIET_YEU đổ xăng", "__label__THIET_YEU đi chợ", "__label__THIET_YEU tiền điện",
    "__label__THIET_YEU tiền nước", "__label__THIET_YEU siêu thị", "__label__THIET_YEU mua rau",
    "__label__THIET_YEU mua gạo", "__label__THIET_YEU tiền rác", "__label__THIET_YEU mạng",
    "__label__THIET_YEU thuốc", "__label__THIET_YEU khám bệnh", "__label__THIET_YEU cắt tóc",
    "__label__THIET_YEU gửi xe", "__label__THIET_YEU cơm trưa", "__label__THIET_YEU ăn sáng",
    "__label__THIET_YEU sửa xe", "__label__THIET_YEU mua thịt", "__label__THIET_YEU mua cá",
    
    # --- HƯỞNG THỤ ---
    "__label__HUONG_THU xem phim", "__label__HUONG_THU cafe", "__label__HUONG_THU cà phê",
    "__label__HUONG_THU trà sữa", "__label__HUONG_THU áo mới", "__label__HUONG_THU nạp game",
    "__label__HUONG_THU ăn nhậu", "__label__HUONG_THU massage", "__label__HUONG_THU đi bar",
    "__label__HUONG_THU pub", "__label__HUONG_THU karaoke", "__label__HUONG_THU du lịch",
    "__label__HUONG_THU vé máy bay", "__label__HUONG_THU mua sắm", "__label__HUONG_THU giày",
    "__label__HUONG_THU mỹ phẩm", "__label__HUONG_THU spa", "__label__HUONG_THU xem ca nhạc",
    "__label__HUONG_THU mua đồ chơi", "__label__HUONG_THU nhậu",
    
    # --- GIÁO DỤC ---
    "__label__GIAO_DUC học phí", "__label__GIAO_DUC mua sách", "__label__GIAO_DUC khóa học",
    "__label__GIAO_DUC học tiếng anh", "__label__GIAO_DUC tiền học", "__label__GIAO_DUC mua vở",
    "__label__GIAO_DUC gia sư", "__label__GIAO_DUC thi ielts", "__label__GIAO_DUC học thêm",
    "__label__GIAO_DUC mua bút", "__label__GIAO_DUC học lái xe", "__label__GIAO_DUC học đàn",
    
    # --- ĐẦU TƯ ---
    "__label__DAU_TU cổ phiếu", "__label__DAU_TU mua vàng", "__label__DAU_TU mua coin",
    "__label__DAU_TU gửi tiết kiệm", "__label__DAU_TU chứng khoán", "__label__DAU_TU bitcoin",
    "__label__DAU_TU mua đất", "__label__DAU_TU đầu tư", "__label__DAU_TU quỹ mở",
    "__label__DAU_TU trái phiếu", "__label__DAU_TU mở sổ", "__label__DAU_TU crypto",
    
    # --- TÍCH LŨY ---
    "__label__TICH_LUY heo đất", "__label__TICH_LUY bỏ ống", "__label__TICH_LUY tiền tiết kiệm",
    "__label__TICH_LUY quỹ dự phòng", "__label__TICH_LUY đút két", "__label__TICH_LUY tiền riêng",
    "__label__TICH_LUY thu họ", "__label__TICH_LUY để dành",
    
    # --- CHO ĐI ---
    "__label__CHO_DI đám cưới", "__label__CHO_DI từ thiện", "__label__CHO_DI biếu bố mẹ",
    "__label__CHO_DI cho em", "__label__CHO_DI mừng tuổi", "__label__CHO_DI lì xì",
    "__label__CHO_DI đám ma", "__label__CHO_DI phúng viếng", "__label__CHO_DI cúng",
    "__label__CHO_DI ủng hộ", "__label__CHO_DI quà sinh nhật", "__label__CHO_DI tiền tip",
    "__label__CHO_DI đổ mỡ bò", "__label__CHO_DI bơm máu", "__label__CHO_DI cúng dường"
]

DATA_PATH = "training_data.txt"
MODEL_PATH = "brain1_model.bin"

# 1. Update file dữ liệu
print("Đang bổ sung thêm 70+ mẫu dữ liệu ngắn và siêu lóng...")
with open(DATA_PATH, "a", encoding="utf-8") as f:
    for item in extra_data:
        # Nhân đôi số lượng các mẫu ngắn để FastText ưu tiên
        for _ in range(5): 
            f.write(f"{item}\n")

# 2. Xóa model cũ để ép load lại (nếu có cache)
if os.path.exists(MODEL_PATH):
    # Sao lưu
    shutil.copy(MODEL_PATH, f"{MODEL_PATH}.bak")
    os.remove(MODEL_PATH)
    print("Đã xóa model cũ...")

# 3. Train lại
print("Đang train lại model FastText...")
model = fasttext.train_supervised(
    input=DATA_PATH,
    epoch=40,            # Tăng số epoch từ 25 -> 40 để học kỹ hơn 
    lr=0.15,             # Tăng learning rate từ 0.1 -> 0.15
    wordNgrams=3,        # Chụp ngrams dài hơn từ 2 -> 3
    minn=2,
    maxn=5,              # Bắt các n-gram ký tự rộng hơn
    dim=64,              # Tăng độ chi tiết của từ điển (dim: 32 -> 64)
    bucket=200000        # Tăng số bucket 100k -> 200k
)
model.save_model(MODEL_PATH)
print("TRAINING HOÀN TẤT. Đã lưu brain1_model.bin mới!")

