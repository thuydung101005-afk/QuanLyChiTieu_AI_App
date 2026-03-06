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

# FastText (Layer 1)
import fasttext

# Gemini SDK (Layer 2) - new google-genai package
from google import genai
from google.genai import types as genai_types
from dotenv import load_dotenv

load_dotenv()

# ─── Config ────────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.40   # Below this → call Gemini
DB_PATH = "finance.db"        # SQLite DB (same as Node backend)
GEMINI_MODEL = "gemini-2.0-flash"   # Fast + cheap for classification

# Setup Gemini client
_gemini_key = os.getenv("GEMINI_API_KEY", "")
_gemini_client = genai.Client(api_key=_gemini_key) if _gemini_key else None

app = FastAPI(title="AI Brain 1 – Hybrid Classifier")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Schemas ──────────────────────────────────────────────────────────────────
class Jar(BaseModel):
    id: str
    name: str

class PredictRequest(BaseModel):
    text: str
    jars: List[Jar]

class PredictResponse(BaseModel):
    extracted_amount: float
    extracted_name: str
    predicted_jar_id: str
    confidence_score: float
    used_fallback: bool = False   # True nếu Gemini đã được dùng

# ─── Amount Parser ────────────────────────────────────────────────────────────
def parse_amount(text: str) -> float:
    """
    Nhận diện số tiền từ chuỗi tiếng Việt.
    Hỗ trợ: 35k, 1.5tr, 2 triệu, 1 củ, 5 lít, 200 nghìn, 1,500,000
    """
    # Normalize: replace comma-thousands separator
    text = text.replace(",", ".")

    match = re.search(
        r"(\d+(?:\.\d+)?)\s*(k|nghìn|nghin|đ|d|vnd|tr|triệu|trieu|củ|cu|lít|lit|cành|canh|c)?",
        text,
        re.IGNORECASE,
    )
    if not match:
        return 0.0

    amount = float(match.group(1))
    unit = (match.group(2) or "").lower()

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
    clean = re.sub(
        r"\d+(?:[.,]\d+)?\s*(?:k|nghìn|nghin|đ|d|vnd|tr|triệu|trieu|củ|cu|lít|lit|cành|canh|c)?",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return clean.strip() or "Giao dịch"


# ─── FastText Model (Layer 1) ────────────────────────────────────────────────
MODEL_PATH = "brain1_model.bin"
TRAIN_DATA_PATH = "training_data.txt"

_fasttext_model = None

def get_fasttext_model():
    """Tải model vào RAM hoặc tự train nếu chưa có model."""
    global _fasttext_model
    if _fasttext_model is None:
        if os.path.exists(MODEL_PATH):
            print(f"[Brain1] Loading FastText model from {MODEL_PATH}...")
            _fasttext_model = fasttext.load_model(MODEL_PATH)
        elif os.path.exists(TRAIN_DATA_PATH):
            print(f"[Brain1] Training new FastText model from {TRAIN_DATA_PATH}...")
            # Huấn luyện FastText hỗ trợ sub-word n-gram cho tiếng Việt chống sai chính tả
            _fasttext_model = fasttext.train_supervised(
                input=TRAIN_DATA_PATH,
                epoch=50,
                lr=0.5,
                wordNgrams=2,
                minn=2,
                maxn=5,
                dim=100
            )
            _fasttext_model.save_model(MODEL_PATH)
            print(f"[Brain1] Saved model to {MODEL_PATH}!")
        else:
            print("[Brain1] WARNING: No FastText model and no training_data.txt found!")
    return _fasttext_model

import unicodedata

def normalize(text: str) -> str:
    """Lowercase + remove Vietnamese diacritics for fuzzy matching."""
    nfd = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")



def classify_fasttext(text: str, jars: List[Jar]) -> tuple[str, float]:
    """
    Sử dụng FastText để dự đoán nhãn của câu và map về jar_id.
    Returns (jar_id, confidence).
    """
    if not jars:
        raise HTTPException(status_code=400, detail="No jars provided")

    model = get_fasttext_model()
    if not model:
        return jars[0].id, 0.0

    # Tiền xử lý: xóa bỏ số tiền và đưa về dạng in thường không dấu xuống dòng
    clean_text = extract_name(text).lower().replace('\n', ' ').strip()
    
    # Dự đoán (Predict)
    predictions, probabilities = model.predict(clean_text, k=1)
    
    if not predictions:
        return jars[0].id, 0.0
        
    predicted_label = predictions[0].replace("__label__", "")
    confidence = float(probabilities[0])
    
    # Mapping Nhãn về Hũ: Tìm hũ có tên giống với nhãn được dự đoán nhất
    predicted_label_norm = normalize(predicted_label).replace("_", " ")
    
    best_jar = jars[0]
    best_score = -1
    
    for jar in jars:
        jar_norm = normalize(jar.name)
        # Khớp toàn bộ
        if predicted_label_norm in jar_norm or jar_norm in predicted_label_norm:
            best_jar = jar
            best_score = 100
            break
        # Tính điểm dựa trên số từ trùng khớp
        overlap = set(predicted_label_norm.split()) & set(jar_norm.split())
        if len(overlap) > best_score:
            best_score = len(overlap)
            best_jar = jar
            
    # Giảm điểm confidence tự tin nếu ko tìm được map tên hũ phù hợp
    if best_score <= 0:
        confidence *= 0.5
        
    return best_jar.id, round(confidence, 3)



# ─── Gemini Fallback (Layer 2) ────────────────────────────────────────────────
def classify_gemini(text: str, jars: List[Jar]) -> tuple[str, float]:
    """
    Gọi Gemini để phân loại khi TF-IDF không chắc.
    Trả về (jar_id, confidence=0.92) hoặc fallback về jar đầu tiên.
    """
    if not _gemini_client:
        return jars[0].id, 0.4

    jar_list_str = "\n".join([f'- id="{j.id}", tên="{j.name}"' for j in jars])

    prompt = f"""Bạn là chuyên gia phân loại chi tiêu tài chính cá nhân người Việt.
Nhiệm vụ: Phân loại giao dịch sau vào đúng HŨ phù hợp nhất.

Giao dịch: "{text}"

Danh sách hũ:
{jar_list_str}

Hãy trả lời CHỈ với id của hũ phù hợp nhất (ví dụ: user123_necessities).
Không giải thích, không thêm ký tự nào khác."""

    try:
        response = _gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        predicted_id = response.text.strip().strip('"').strip("'")

        # Validate response is a real jar id
        valid_ids = {j.id for j in jars}
        if predicted_id in valid_ids:
            return predicted_id, 0.92
        else:
            # Gemini may have returned jar name instead of id – fuzzy match
            for jar in jars:
                if jar.name.lower() in predicted_id.lower() or predicted_id.lower() in jar.name.lower():
                    return jar.id, 0.85
            return jars[0].id, 0.5
    except Exception as e:
        print(f"[Gemini Fallback Error] {e}")
        return jars[0].id, 0.4


# ─── Save training data to SQLite ─────────────────────────────────────────────
def save_training_data(text: str, jar_id: str, jar_name: str, source: str = "gemini"):
    """Lưu kết quả phân loại vào bảng training_data để train lại về sau."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT OR IGNORE INTO training_data (id, text, jar_id, jar_name, source) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), text, jar_id, jar_name, source),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Training Data Save Error] {e}")


# ─── Main Endpoint ────────────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictResponse)
async def predict_transaction(request: PredictRequest):
    text = request.text.strip()
    jars = request.jars

    if not text or not jars:
        raise HTTPException(status_code=400, detail="text and jars are required")

    amount = parse_amount(text)
    name = extract_name(text)
    if not name or name.lower() == text.lower():
        name = "Giao dịch"

    # ── Layer 1: FastText Classifier ──────────────────────────────────────────
    jar_id, confidence = classify_fasttext(text, jars)
    used_fallback = False

    print(f"[Brain1] FastText → jar={jar_id}, confidence={confidence:.2f}, text='{text}'")

    # ── Layer 2: Gemini Fallback if confidence too low ───────────────────────
    if confidence < CONFIDENCE_THRESHOLD:
        print(f"[Brain1] Confidence {confidence:.2f} < {CONFIDENCE_THRESHOLD} → calling Gemini...")
        jar_id, confidence = classify_gemini(text, jars)
        used_fallback = True

        # Persist training data for future retraining
        matched_jar = next((j for j in jars if j.id == jar_id), jars[0])
        save_training_data(text, jar_id, matched_jar.name, source="gemini")
        print(f"[Brain1] Gemini → jar={jar_id}, confidence={confidence:.2f} (saved to training_data)")

    return PredictResponse(
        extracted_amount=amount,
        extracted_name=name.capitalize(),
        predicted_jar_id=jar_id,
        confidence_score=round(confidence, 3),
        used_fallback=used_fallback,
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gemini_configured": bool(_gemini_key),
        "confidence_threshold": CONFIDENCE_THRESHOLD,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
