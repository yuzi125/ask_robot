import requests

class TaideAPI:
    def __init__(self, username, password, host="https://td.nchc.org.tw/api/v1"):
        self.host = host
        self.token = self.get_token(username, password)

    def get_token(self, username, password):
        response = requests.post(f"{self.host}/token", data={"username": username, "password": password})
        return response.json()["access_token"]

    def chat(self, question, model="TAIDE/b.1.0.0", temperature=0.2, top_p=0.9, presence_penalty=1, frequency_penalty=1, max_tokens=500):
        prompt = f"[INST] {question} [/INST]"
        headers = {"Authorization": "Bearer " + self.token}
        data = {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "top_p": top_p,
            "presence_penalty": presence_penalty,
            "frequency_penalty": frequency_penalty,
            "max_tokens": max_tokens
        }
        response = requests.post(f"{self.host}/completions", json=data, headers=headers)
        return response.json()["choices"][0]["text"]

# 使用範例
# taide_api = TaideAPI("jingpei6@kcg.gov.tw", "taidetest")
# question = "你剛剛參加了一場關於環保的公共演講，感受良多，希望能寫一封信給演講者表示感謝。請根據你的感受和收穫，寫出一封感謝信的內容。"
# response = taide_api.chat(question)
# print(response)
