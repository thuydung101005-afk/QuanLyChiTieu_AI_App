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

# TF-IDF (Layer 0 - Zero-shot)
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Gemini SDK (Layer 2) - new google-genai package
from google import genai
from google.genai import types as genai_types
from dotenv import load_dotenv

load_dotenv(override=True)

# ─── Config ────────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.45   # Tăng ngưỡng lên 0.45 để giao cho Gemini nếu FastText không chắc chắn
DB_PATH = "finance.db"        # SQLite DB (same as Node backend)
GEMINI_MODEL = "gemini-2.5-flash"   # Sử dụng Model mới nhất giống Node.js để tránh văng Rate Limit

# Setup Gemini client
_gemini_key = os.getenv("GEMINI_API_KEY", "")
_gemini_client = genai.Client(api_key=_gemini_key) if _gemini_key else None

app = FastAPI(title="AI Brain 1 – Hybrid Classifier")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Schemas ──────────────────────────────────────────────────────────────────
class UserJar(BaseModel):
    id: str
    name: str

class PredictRequest(BaseModel):
    text: str
    jars: List[UserJar] = []

class PredictResponse(BaseModel):
    extracted_amount: float
    extracted_name: str
    predicted_concept: str
    predicted_jar_id: Optional[str] = None
    confidence_score: float
    used_fallback: bool = False   # True nếu Gemini đã được dùng

class LearnRequest(BaseModel):
    text: str
    concept: str

# ─── Amount Parser ────────────────────────────────────────────────────────────
def parse_amount(text: str) -> float:
    """
    Nhận diện và tính tổng TẤT CẢ các số tiền có trong chuỗi tiếng Việt.
    Hỗ trợ: 35k, 1.5tr, 2 triệu, 1 củ, 5 lít, 200 nghìn, 1,500,000, 50.000
    Chỉ cộng các số liệu mang định dạng tiền tệ rõ ràng để tránh cộng nhầm danh từ riêng có số.
    """
    # Normalize: replace comma-thousands separator
    text = text.replace(",", ".")

    # Preprocess shorthand numbers: "1tr5" -> "1.5tr", "2 củ 5" -> "2.5củ"
    text = re.sub(r'(\d+)\s*(tr|triệu|trieu|củ|cu|lít|lit|cành|canh)\s*(\d+)\b', r'\1.\3\2', text, flags=re.IGNORECASE)

    # Regex 1: Số có kèm đơn vị tiền tệ rõ ràng (10k, 5tr, 2 củ)
    matches_with_unit = list(re.finditer(
        r"\b(\d+(?:\.\d+)?)\s*(k|nghìn|nghin|đ|d|vnd|tr|triệu|trieu|củ|cu|lít|lit|cành|canh|c)\b",
        text,
        re.IGNORECASE,
    ))

    # Regex 2: Số dứt điểm bằng 000 hoặc có dấu phân cách hàng ngàn (50.000, 100000)
    matches_raw_money = list(re.finditer(
        r"\b(\d+(?:\.\d{3})+|\d+000)\b",
        text,
    ))

    total_amount = 0.0
    
    # 1. Cộng các số có đơn vị
    for match in matches_with_unit:
        val = float(match.group(1))
        unit = match.group(2).lower()
        if unit in ("k", "nghìn", "nghin", "cành", "canh"):
            val *= 1_000
        elif unit in ("tr", "triệu", "trieu", "củ", "cu", "c"):
            val *= 1_000_000
        elif unit in ("lít", "lit"):
            val *= 100_000
        total_amount += val
        
    # 2. Cộng các số raw money (chưa có đơn vị) 
    # (Nếu đoạn text đó chưa được pick bởi regex 1)
    unit_match_positions = [m.span() for m in matches_with_unit]
    for match in matches_raw_money:
        span = match.span()
        # Đảm bảo số này không bị over-lap với số đã cộng ở nhóm 1
        is_overlapped = any(start <= span[0] <= end or start <= span[1] <= end for start, end in unit_match_positions)
        if not is_overlapped:
            val = float(match.group(1).replace(".", ""))
            total_amount += val

    return total_amount


def extract_name(text: str) -> str:
    """Xóa phần số tiền khỏi mô tả."""
    # Preprocess shorthand numbers: "1tr5" -> "1.5tr"
    clean = re.sub(r'(\d+)\s*(tr|triệu|trieu|củ|cu|lít|lit|cành|canh)\s*(\d+)\b', r'\1.\3\2', text, flags=re.IGNORECASE)
    
    # 1. Remove numbers with explicit currency units (k, tr, đ, củ, lít, ...)
    clean = re.sub(
        r"\b\d+(?:[.,]\d+)?\s*(k|nghìn|nghin|đ|d|vnd|tr|triệu|trieu|củ|cu|lít|lit|cành|canh|c)\b",
        "",
        clean,
        flags=re.IGNORECASE,
    )
    
    # 2. Remove obvious un-suffixed money numbers: e.g. "50000" (ends in 000) or "50.000" / "50,000"
    clean = re.sub(
        r"\b\d+(?:[.,]\d{3})+\b|\b\d+000\b",
        "",
        clean,
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

# ─── TF-IDF Hybrid Ranking (Layer 0) ──────────────────────────────────────────
def classify_tfidf(text: str, jars: List[UserJar]) -> tuple[Optional[str], float]:
    """
    Sử dụng TF-IDF và Cosine Similarity để so khớp input với Tên Hũ.
    Giải quyết bài toán Cold Start (Zero-shot classification)
    Returns: (jar_id, confidence) hoặc (None, 0.0) nếu không đạt ngưỡng.
    """
    if not jars or not text:
        return None, 0.0
        
    # Chuẩn bị danh sách văn bản (query là text đầu tiên, sau đó là tên các hũ)
    # Dùng hàm normalize để bỏ dấu tiếng Việt giúp matching linh hoạt hơn
    clean_query = normalize(extract_name(text).lower().strip())
    
    jar_names = [normalize(jar.name.lower().strip()) for jar in jars]
    corpus = [clean_query] + jar_names
    
    try:
        vectorizer = TfidfVectorizer(ngram_range=(1, 2)) # Hỗ trợ cụm 1-2 từ (VD: "bỉm", "bỉm sữa")
        tfidf_matrix = vectorizer.fit_transform(corpus)
        
        # Tính cosine similarity giữa query (index 0) và tất cả các hũ (index 1 trở đi)
        cosine_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
        
        best_idx = np.argmax(cosine_sim)
        best_score = float(cosine_sim[best_idx])
        
        if best_score > 0.75: # Ngưỡng tự tin khá cao để tránh nhận nhầm
            print(f"[Brain0-TFIDF] MATCHED: '{clean_query}' <-> '{jar_names[best_idx]}' (Score: {best_score:.2f})")
            return jars[best_idx].id, best_score
            
        print(f"[Brain0-TFIDF] No match found (Best score: {best_score:.2f} for '{jar_names[best_idx]}')")
        return None, best_score
        
    except Exception as e:
        print(f"[Brain0-TFIDF] Error: {e}")
        return None, 0.0




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
        conn.execute("PRAGMA journal_mode=WAL")
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

    # Nhận diện thông tin
    predicted_concept = "GIAO_DICH_KHAC"
    confidence = 0.0
    used_fallback = False
    predicted_jar_id = None

    # ── Layer 0: TF-IDF Zero-shot Classification ──────────────────────────────
    if request.jars:
        predicted_jar_id, tfidf_confidence = classify_tfidf(text, request.jars)
        if predicted_jar_id:
            return PredictResponse(
                extracted_amount=amount,
                extracted_name=name.capitalize(),
                predicted_concept="GIAO_DICH_KHAC", # Concept không còn quan trọng vì đã có chính xác ID hũ
                predicted_jar_id=predicted_jar_id,
                confidence_score=round(tfidf_confidence, 3),
                used_fallback=False,
            )

    # ── Layer 1: FastText Classifier ──────────────────────────────────────────
    predicted_concept, confidence = classify_fasttext(text)

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
        predicted_jar_id=None,
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
