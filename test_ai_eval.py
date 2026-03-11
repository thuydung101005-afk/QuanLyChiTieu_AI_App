import requests
import json

url = "http://127.0.0.1:8000/predict"

def test_prediction(description, jars):
    payload = {
        "text": description,
        "jars": jars
    }
    
    print(f"--- Sending: '{description}' ---")
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        response.raise_for_status()
        result = response.json()
        
        print("Response:", json.dumps(result, indent=2, ensure_ascii=False))
        if result.get('predicted_jar_id'):
            print(f"✅ TF-IDF ZERO-SHOT MATCH: Jar ID -> {result['predicted_jar_id']}")
        else:
            print(f"⚠️ NO ZERO-SHOT MATCH. FastText Concept -> {result['predicted_concept']}")
            
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    # Mock some user jars
    user_jars = [
        {"id": "jar_nhau", "name": "Tiệc tùng ăn nhậu"},
        {"id": "jar_bim", "name": "Bỉm tã cho em bé"},
        {"id": "jar_nha", "name": "Tiền nhà trọ"},
    ]
    
    # 1. Test existing concept (should fall to FastText/Gemini if no exact match or tf-idf)
    test_prediction("ăn bát phở 30k", user_jars)
    
    # 2. Test Zero-shot with exact/fuzzy name match (TF-IDF should catch this)
    test_prediction("mua 2 bịch bỉm tã cho em bé 500k", user_jars)
    
    # 3. Test another Zero-shot
    test_prediction("đi ăn nhậu với công ty 1tr", user_jars)
    
    # 4. Without jars (Should fall to FastText)
    test_prediction("ăn bát phở 30k", [])
