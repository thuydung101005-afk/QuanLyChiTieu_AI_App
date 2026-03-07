import fasttext

try:
    model = fasttext.load_model('brain1_model.bin')
    text = "Đi đám cưới".lower().strip()
    predictions, probabilities = model.predict(text, k=1)
    print(f"Text: {text}")
    print(f"Predicted: {predictions[0]}")
    print(f"Probability: {probabilities[0]}")
except Exception as e:
    print(f"Error: {e}")
