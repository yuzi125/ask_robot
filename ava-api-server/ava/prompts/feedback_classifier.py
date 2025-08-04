import json
class _Bureau:
    def __init__(self, name:str, code:int, description:str):
        self.name = name
        self.code = code
        self.description = description

    def __str__(self):
        return f"code={self.code}, name={self.name}"

_bureau_map = {}
with open("ava-api-server/config/bureauData.json", "r", encoding="utf-8") as f:
    bureau_data = json.load(f)
for bureau in bureau_data:
    _bureau_map[bureau["bureau_name"]] = _Bureau(bureau["bureau_name"], bureau["bureau_code"], bureau["administrative_duties"])

_bureau_prompt = f'''
1. 請根據以下資訊進行問題分類:
{"\n".join([str(bureau) for bureau in _bureau_map.values()])}

2. 分類範例:
戶籍改至高雄步驟 => 14
申請補助需要什麼文件 => -1
如何取得就業相關資訊 => 4
高雄文化特色 => 11

3. 問題格式:
{{
    id1: Q1,
    id2: Q2,
    ...
    idn: Qn
}}

4. 回答格式:
{{
    id1: [code1-1, code1-2 ...], 
    id2: [code2-1, ...], 
    ...
    idn: [...]
}}

5. 回答個數務必等於問題個數

6. 可以將問題劃分至多個class, 除非確定問題都不屬於其他分類，才能將問題放在單個"無法分類" ([-1])

7. 考慮多層次關聯：某些問題可能與多個局處相關，如「新生兒出生」涉及民政局（登記）、衛生局（健康檢查）、社會局（兒童福利）。
            
8. 泛化判斷邏輯：確保不僅適用於特定問題，而能適應類似場景，例如「老人補助」應能聯想到社會局、「流感疫苗接種」應能聯想到衛生局等。

9. 只能回覆分類結果，不要回覆推理過程

以下是問題: 
$...PROMPT...
'''

def feedback_classify_prompt(feedbacks:str) -> str:   
    prompt = _bureau_prompt.replace("$...PROMPT...", feedbacks)
    return prompt


