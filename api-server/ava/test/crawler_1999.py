import requests
import json

# 從 urls.txt 讀取 URL 列表
with open('urls.txt', 'r', encoding='utf-8') as file:
    urls = file.read().strip().split('\n')

# 移除開頭和結尾的方括號
urls = [url.strip().strip('",') for url in urls]
urls = [url for url in urls if url]  # 移除空行

# 用於存儲所有資料的陣列
all_data = []

# 遍歷 URL 列表
for index, url in enumerate(urls):
    # 發送 HTTP 請求並解析 JSON 資料
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        # 從 URL 中提取 OrganNo 和 SeqNo
        organ_no = url.split('?seqNo=')[0].split('/')[-1]
        seq_no = url.split('?seqNo=')[1].split('&')[0]
        
        # 建立最終格式的字典
        final_data = {
            "text": data["IssueContent"],
            "title": data["ReplyOrganName"],
            "url":f"https://soweb.kcg.gov.tw/#/faqdetail/{organ_no}/{seq_no}",
            "html":data["ReplyContent"]+"更新日期:"+data["ReviseDate"]+"發文日期:"+data["PostDate"],
        }
        all_data.append(final_data)

    # 每處理 10 個 URL，打印一次進度信息
    if (index + 1) % 10 == 0:
        print(f"已處理 {index + 1} 個網址")

# 將資料寫入 JSON 文件
with open('data.json', 'w', encoding='utf-8') as file:
    json.dump(all_data, file, ensure_ascii=False, indent=4)

print("所有數據已處理完畢並保存。")
