import os
import json
import re

# 定義存放檔案的資料夾名稱
folder_name = "faq_data"
os.makedirs(folder_name, exist_ok=True)

# 定義非法字符的替換規則
def sanitize_filename(filename):
    # 使用正則表達式將 URL 中的非法字符替換為下劃線或其他合法字符
    return re.sub(r'[<>:"/\\|?*]', '_', filename)

# 讀取 data.json 檔案
with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 遍歷每個資料物件並保存為 JSON 文件
for item in data:
    # 從 URL 生成合法的檔案名
    filename = sanitize_filename(item['url']) + '.json'
    
    # 將資料寫入 JSON 文件
    with open(os.path.join(folder_name, filename), 'w', encoding='utf-8') as file:
        json.dump(item, file, ensure_ascii=False, indent=4)

print(f"所有資料已保存到資料夾 '{folder_name}' 中。")
