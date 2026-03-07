import os

data = [
    "__label__CHO_DI đi đám cưới",
    "__label__CHO_DI phong bì đám cưới",
    "__label__CHO_DI ăn cưới",
    "__label__CHO_DI mừng cưới"
]

with open('training_data.txt', 'a', encoding='utf-8') as f:
    for line in data:
        f.write(line + '\n')
print("Đã thêm từ khóa đám cưới vào training_data.txt")

if os.path.exists('brain1_model.bin'):
    os.remove('brain1_model.bin')
    print("Đã xóa file brain1_model.bin thành công để ép Train lại!")
