import sqlite3
import os
import sys

# Thêm đường dẫn để import từ ai_service nếu cần
from ai_service import extract_name

DB_PATH = "finance.db"
TRAIN_DATA_PATH = "training_data.txt"
TEMP_DATA_PATH = "training_data_pruned.txt"

def prune_training_data():
    if not os.path.exists(DB_PATH) or not os.path.exists(TRAIN_DATA_PATH):
        print("[Auto-Pruner] Database or training file missing. Skipping pruning.")
        return

    print("[Auto-Pruner] Starting data pruning process...")

    # 1. Lấy Ground Truth mới nhất từ Database (Latest Concept for Each Text)
    # Lấy những dòng do người dùng sửa (user_correction) làm Ground Truth tuyệt đối
    # Nếu cùng 1 text có nhiều dòng, dòng `created_at` mới nhất sẽ đè lên
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Lấy ground truth từ user corrections
    cursor.execute('''
        SELECT text, concept 
        FROM training_data 
        WHERE source = 'user_correction'
        ORDER BY created_at ASC
    ''')
    user_corrections = cursor.fetchall()
    
    # Map lưu ground truth chuẩn nhất theo core text đã lọc tiền: { "đổ xăng": "GIAO_DICH_KHAC", ... }
    ground_truth_map = {}
    for row in user_corrections:
        clean_text = extract_name(row['text']).lower().replace('\n', ' ').strip()
        ground_truth_map[clean_text] = row['concept']
        
    conn.close()
    
    if not ground_truth_map:
        print("[Auto-Pruner] No user corrections found. File remains unchanged.")
        return
        
    print(f"[Auto-Pruner] Found {len(ground_truth_map)} unique core keywords with updated Ground Truth.")

    # 2. Đọc toàn bộ training_data.txt và lọc rác
    lines_kept = 0
    lines_removed = 0
    lines_rewritten = 0
    
    with open(TRAIN_DATA_PATH, "r", encoding="utf-8") as f_in, \
         open(TEMP_DATA_PATH, "w", encoding="utf-8") as f_out:
             
        for line in f_in:
            line_str = line.strip()
            if not line_str.startswith("__label__"):
                continue
                
            # Phân tách label và text: "__label__THIET_YEU đổ xăng" -> "THIET_YEU", "đổ xăng"
            parts = line_str.split(" ", 1)
            if len(parts) < 2:
                continue
                
            label_part = parts[0].replace("__label__", "")
            text_part = parts[1].strip()
            
            # Kiểm tra xem text_part này có nằm trong bộ Ground Truth đã lật kèo không?
            if text_part in ground_truth_map:
                correct_label = ground_truth_map[text_part]
                
                # Nếu file cũ đang chứa nhãn SAI so với Ground Truth MỚI NHẤT -> Xoá rác (không ghi vào file mới)
                if label_part != correct_label:
                    lines_removed += 1
                    # Cứ xoá đi, lúc user sửa nó đã tự append 5 dòng đúng vào cuối file rồi, 
                    # nên không cần phải biến đổi dòng này thành dòng đúng, vì sẽ gây lặp thừa thãi.
                    continue
            
            # Nếu không vi phạm gì, hoặc dữ liệu nguyên gốc chuẩn -> Ghi vào file mới
            f_out.write(line_str + "\n")
            lines_kept += 1
            
    # 3. Thay thế file cũ
    os.replace(TEMP_DATA_PATH, TRAIN_DATA_PATH)
    
    print(f"[Auto-Pruner] Pruning complete!")
    print(f"[Auto-Pruner] - Lines kept: {lines_kept}")
    print(f"[Auto-Pruner] - Conflicting junk lines removed: {lines_removed}")

if __name__ == "__main__":
    prune_training_data()
