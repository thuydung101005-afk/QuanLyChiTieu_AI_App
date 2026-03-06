import asyncio
from typing import List
from pydantic import BaseModel
from ai_service import predict_transaction, PredictRequest, Jar

async def main():
    jars = [
        Jar(id="user_sinh_hoat", name="Sinh hoạt"),
        Jar(id="user_giai_tri", name="Giải trí"),
        Jar(id="user_cho_di", name="Cho đi")
    ]
    
    test_cases = [
        "mua hộp cơm tấm 35k",
        "vé cgv xem phim 100 cành",
        "quyên góp từ thiện đồng bào bão lụt"
    ]
    
    print("=== TEST NHANH FASTTEXT ===")
    for text in test_cases:
        req = PredictRequest(text=text, jars=jars)
        res = await predict_transaction(req)
        print(f"\nText: {text}")
        print(f" -> Predicted Jar ID: {res.predicted_jar_id}")
        print(f" -> Confidence: {res.confidence_score}")
        print(f" -> Fallback (Gemini used?): {res.used_fallback}")

if __name__ == "__main__":
    asyncio.run(main())
