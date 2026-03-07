"""
AI Brain 1 – Hybrid Fallback Architecture
=========================================
Layer 1 (Fast): TF-IDF + Cosine Similarity against a curated Vietnamese corpus
               Target latency: < 0.1s, no network calls
Layer 2 (Smart): Gemini API fallback when Layer 1 confidence < CONFIDENCE_THRESHOLD
               Results saved to SQLite training_data for future model retraining
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import re
import os
import sqlite3
import uuid
import uvicorn
import asyncio

# FastText (Layer 1)
import fasttext

# Gemini SDK (Layer 2) - new google-genai package
from google import genai
from google.genai import types as genai_types
from dotenv import load_dotenv

load_dotenv(override=True)

# ─── Config ────────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.45   # Tăng ngưỡng lên 0.45 để giao cho Gemini nếu FastText không chắc chắn
DB_PATH = "finance.db"        # SQLite DB (same as Node backend)
GEMINI_MODEL = "gemini-2.0-flash"   # Fast + cheap for classification

# Setup Gemini client
_gemini_key = os.getenv("GEMINI_API_KEY", "")
_gemini_client = genai.Client(api_key=_gemini_key) if _gemini_key else None

app = FastAPI(title="AI Brain 1 – Hybrid Classifier")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Schemas ──────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    text: str

class PredictResponse(BaseModel):
    extracted_amount: float
    extracted_name: str
    predicted_concept: str
    confidence_score: float
    used_fallback: bool = False   # True nếu Gemini đã được dùng

class LearnRequest(BaseModel):
    text: str
    concept: str

# ─── Amount Parser ────────────────────────────────────────────────────────────
def parse_amount(text: str) -> float:
    """
    Nhận diện số tiền từ chuỗi tiếng Việt.
    Hỗ trợ: 35k, 1.5tr, 2 triệu, 1 củ, 5 lít, 200 nghìn, 1,500,000
    Ưu tiên lấy con số ở cuối hoặc có kèm đơn vị rõ ràng.
    """
    # Normalize: replace comma-thousands separator
    text = text.replace(",", ".")

    # Preprocess shorthand numbers: "1tr5" -> "1.5tr", "2 củ 5" -> "2.5củ"
    text = re.sub(r'(\d+)\s*(tr|triệu|trieu|củ|cu|lít|lit|cành|canh)\s*(\d+)\b', r'\1.\3\2', text, flags=re.IGNORECASE)

    matches = list(re.finditer(
        r"(\d+(?:\.\d+)?)\s*(k|nghìn|nghin|đ|d|vnd|tr|triệu|trieu|củ|cu|lít|lit|cành|canh|c)?\b",
        text,
        re.IGNORECASE,
    ))
    
    if not matches:
        return 0.0

    # Ưu tiên lấy match có đơn vị tiền tệ, nếu không có thì lấy chuỗi số cuối cùng
    best_match = matches[-1] # Mặc định lấy số cuối cùng
    for match in reversed(matches):
        if match.group(2): # Nếu có đơn vị
            best_match = match
            break

    amount = float(best_match.group(1))
    unit = (best_match.group(2) or "").lower()

    if unit in ("k", "nghìn", "nghin", "cành", "canh"):
        amount *= 1_000
    elif unit in ("tr", "triệu", "trieu", "củ", "cu", "c"):
        amount *= 1_000_000
    elif unit in ("lít", "lit"):
        amount *= 100_000
    else:
        # Bare number < 1000 in VN context → assume thousands
        if 0 < amount < 1_000:
            amount *= 1_000

    return amount


def extract_name(text: str) -> str:
    """Xóa phần số tiền khỏi mô tả."""
    # Preprocess shorthand numbers: "1tr5" -> "1.5tr"
    clean = re.sub(r'(\d+)\s*(tr|triệu|trieu|củ|cu|lít|lit|cành|canh)\s*(\d+)\b', r'\1.\3\2', text, flags=re.IGNORECASE)
    
    clean = re.sub(
        r"\d+(?:[.,]\d+)?\s*(?:k|nghìn|nghin|đ|d|vnd|tr|triệu|trieu|củ|cu|lít|lit|cành|canh|c)?\b",
        "",
        clean,
        flags=re.IGNORECASE,
    )
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean or "Giao dịch"


# ─── FastText Model (Layer 1) ────────────────────────────────────────────────
MODEL_PATH = "brain1_model.bin"
TRAIN_DATA_PATH = "training_data.txt"

_fasttext_model = None
_model_mtime: float = 0.0  # Thời gian chỉnh sửa của file .bin lúc load lần cuối

# ─── Async Debounce Retrain State ──────────────────────────────────────────────
_retrain_task: asyncio.Task | None = None
_RETRAIN_DEBOUNCE_SECS = 30  # Chờ 30s không có feedback mới mới thực sự retrain

async def _debounced_retrain():
    """Chờ DEBOUNCE giây, sau đó chạy retrain trong threadpool. An toàn với uvicorn."""
    try:
        print(f"[Brain1] Debounce: chờ {_RETRAIN_DEBOUNCE_SECS}s trước khi retrain...")
        await asyncio.sleep(_RETRAIN_DEBOUNCE_SECS)
        print("[Brain1] Bắt đầu retrain (asyncio threadpool)...")
        await asyncio.to_thread(retrain_model_background)
        print("[Brain1] Retrain hoàn tất!")
    except asyncio.CancelledError:
        print("[Brain1] Retrain được đặt lịch lại (debounce reset).")

def _schedule_retrain():
    """Hủy task retrain đang chờ (nếu có) và tạo task mới."""
    global _retrain_task
    if _retrain_task is not None and not _retrain_task.done():
        _retrain_task.cancel()
    try:
        loop = asyncio.get_running_loop()
        _retrain_task = loop.create_task(_debounced_retrain())
        print(f"[Brain1] Retrain được lên lịch sau {_RETRAIN_DEBOUNCE_SECS}s...")
    except RuntimeError:
        # Không có event loop (ví dụ: chạy trong test thẺ) - bỏ qua
        print("[Brain1] Không có event loop, bỏ qua retrain scheduling.")

def get_fasttext_model():
    """Tải model vào RAM hoặc tự train nếu chưa có model. Tự động reload nếu file .bin mới hơn."""
    global _fasttext_model, _model_mtime

    # Kiểm tra xem file .bin trên disk có mới hơn bản đang chạy trong RAM không
    if os.path.exists(MODEL_PATH):
        current_mtime = os.path.getmtime(MODEL_PATH)
        if current_mtime > _model_mtime:
            print(f"[Brain1] Phát hiện model mới trên disk! Đang tải lại...")
            if _fasttext_model is not None:
                del _fasttext_model
                _fasttext_model = None
            _fasttext_model = fasttext.load_model(MODEL_PATH)
            _model_mtime = current_mtime
            print(f"[Brain1] Đã nạp model mới vào RAM!")
    elif _fasttext_model is None:
        if os.path.exists(TRAIN_DATA_PATH):
            print(f"[Brain1] Không tìm thấy .bin, đang train mới từ {TRAIN_DATA_PATH}...")
            _fasttext_model = fasttext.train_supervised(
                input=TRAIN_DATA_PATH,
                epoch=25,
                lr=0.1,
                wordNgrams=2,
                minn=2,
                maxn=4,
                dim=32,
                bucket=100000
            )
            _fasttext_model.save_model(MODEL_PATH)
            _model_mtime = os.path.getmtime(MODEL_PATH)
            print(f"[Brain1] Đã lưu model ra {MODEL_PATH}!")
        else:
            print("[Brain1] WARNING: Không có model và không có training_data.txt!")
    return _fasttext_model

import unicodedata

def normalize(text: str) -> str:
    """Lowercase + remove Vietnamese diacritics for fuzzy matching."""
    nfd = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")

def retrain_model_background():
    """Chạy ngầm để huấn luyện lại mô hình với dữ liệu mới"""
    global _fasttext_model
    if os.path.exists(TRAIN_DATA_PATH):
        print(f"[Brain1] XIN TRÂN TRỌNG BÁO CÁO: Đang huấn luyện lại FastText từ file {TRAIN_DATA_PATH}...")
        
        # 0. Dọn rác dữ liệu trước khi train
        try:
            prune_training_data()
        except Exception as e:
            print(f"[Brain1] Auto-Pruner error (skipping): {e}")

        # 1. Xoá model cũ khỏi memory
        if _fasttext_model is not None:
            del _fasttext_model
            _fasttext_model = None

        _fasttext_model = fasttext.train_supervised(
            input=TRAIN_DATA_PATH,
            epoch=25,
            lr=0.1,
            wordNgrams=2,
            minn=2,
            maxn=4,
            dim=32,
            bucket=100000
        )
        _fasttext_model.save_model(MODEL_PATH)
        print(f"[Brain1] Tuyệt vời! Đã update file não {MODEL_PATH} phiên bản mới nhất!")



def classify_fasttext(text: str) -> tuple[str, float]:
    """
    Sử dụng FastText để dự đoán Global Concept của câu.
    Returns (concept, confidence).
    """
    model = get_fasttext_model()
    if not model:
        return "GIAO_DICH_KHAC", 0.0

    # Tiền xử lý: xóa bỏ số tiền và đưa về dạng in thường không dấu xuống dòng
    clean_text = extract_name(text).lower().replace('\n', ' ').strip()
    
    # Dự đoán (Predict)
    predictions, probabilities = model.predict(clean_text, k=1)
    
    if not predictions:
        return "GIAO_DICH_KHAC", 0.0
        
    predicted_concept = predictions[0].replace("__label__", "")
    confidence = float(probabilities[0])
    
    return predicted_concept, round(confidence, 3)



# ─── Gemini Fallback (Layer 2) ────────────────────────────────────────────────
def classify_gemini(text: str) -> tuple[str, float]:
    """
    Gọi Gemini để phân loại vào 1 trong 7 Global Concepts khi FastText không chắc.
    """
    if not _gemini_client:
        return "GIAO_DICH_KHAC", 0.4

    prompt = f"""Bạn là chuyên gia phân loại chi tiêu cá nhân.
Nhiệm vụ: Phân loại giao dịch này vào 1 trong 7 nhóm (Global Concepts) sau:
- THIET_YEU (nhu cầu thiết yếu, ăn uống nạp năng lượng, nhà ở, điện nước, đi lại cơ bản)
- HUONG_THU (giải trí, du lịch, mua sắm tận hưởng, bạn bè, ăn nhậu, mua đồ tiêu sản)
- GIAO_DUC (học tập, sách vở, khóa học)
- DAU_TU (mua tài sản sinh lời, chứng khoán, vàng)
- TICH_LUY (tiết kiệm tiết kiệm dài hạn, quỹ khẩn cấp)
- CHO_DI (từ thiện, gửi biếu, quà cáp, đám hỏi)
- GIAO_DICH_KHAC (không thuộc các nhóm trên)

Giao dịch: "{text}"

Hãy trả lời CHỈ với TÊN MÃ NHÓM ghi hoa (ví dụ: THIET_YEU).
Không giải thích, không thêm ký tự nào khác."""

    try:
        response = _gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        predicted_concept = response.text.strip().strip('"').strip("'").upper()

        valid_concepts = {"THIET_YEU", "HUONG_THU", "GIAO_DUC", "DAU_TU", "TICH_LUY", "CHO_DI", "GIAO_DICH_KHAC"}
        if predicted_concept in valid_concepts:
            return predicted_concept, 0.92
        return "GIAO_DICH_KHAC", 0.5
    except Exception as e:
        print(f"[Gemini Fallback Error] {e}")
        return "GIAO_DICH_KHAC", 0.4


# ─── Save training data to SQLite ─────────────────────────────────────────────
def save_training_data(text: str, concept: str, source: str = "gemini"):
    """Lưu kết quả phân loại vào bảng training_data để tham khảo."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT OR IGNORE INTO training_data (id, text, concept, source) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), text, concept, source),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Training Data Save Error] {e}")


# ─── Main Endpoint ────────────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictResponse)
async def predict_transaction(request: PredictRequest):
    text = request.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    amount = parse_amount(text)
    name = extract_name(text)
    if not name or name.lower() == text.lower():
        name = "Giao dịch"

    # ── Layer 1: FastText Classifier ──────────────────────────────────────────
    predicted_concept, confidence = classify_fasttext(text)
    used_fallback = False

    print(f"[Brain1] FastText → concept={predicted_concept}, confidence={confidence:.2f}, text='{text}'")

    # ── Layer 2: Gemini Fallback if confidence too low ───────────────────────
    if confidence < CONFIDENCE_THRESHOLD:
        print(f"[Brain1] Confidence {confidence:.2f} < {CONFIDENCE_THRESHOLD} → calling Gemini...")
        predicted_concept, confidence = classify_gemini(text)
        used_fallback = True

        # Persist feedback data from Gemini inference
        save_training_data(text, predicted_concept, source="gemini")
        print(f"[Brain1] Gemini → concept={predicted_concept}, confidence={confidence:.2f} (saved to DB)")

    return PredictResponse(
        extracted_amount=amount,
        extracted_name=name.capitalize(),
        predicted_concept=predicted_concept,
        confidence_score=round(confidence, 3),
        used_fallback=used_fallback,
    )

from fastapi import BackgroundTasks

@app.post("/learn")
async def learn_from_feedback(request: LearnRequest, background_tasks: BackgroundTasks):
    """API kích hoạt tự học Auto-Learning khi user sửa dữ liệu"""
    text = request.text.strip()
    concept = request.concept.strip().upper()
    
    if not text or not concept:
        raise HTTPException(status_code=400, detail="text and concept are required")
        
    print(f"[Brain1] Thu thập dữ liệu TỰ HỌC: Text: '{text}' ---> Concept: {concept}")
    
    # 1. Lưu DB
    save_training_data(text, concept, source="user_correction")
    
    # 2. Tiền xử lý giống hệt lúc predict và ghi đè trọng số (ghi 5 lần để override dữ liệu cũ mạnh hơn)
    clean_text = extract_name(text).lower().replace('\n', ' ').strip()
    try:
        if clean_text:
            with open(TRAIN_DATA_PATH, "a", encoding="utf-8") as f:
                for _ in range(5):
                    f.write(f"__label__{concept} {clean_text}\n")
    except Exception as e:
        print(f"[AutoLearn] Lỗi khi ghi file: {e}")
        
    # 3. Kích hoạt retrain NGAY LẬP TỨC dưới nền
    background_tasks.add_task(retrain_model_background)
    
    return {"status": "ok", "message": "Feedback received. Model will be retrained in background."}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gemini_configured": bool(_gemini_key),
        "confidence_threshold": CONFIDENCE_THRESHOLD,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
