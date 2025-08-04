import base64
from openai import OpenAI

client = OpenAI(api_key="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")


def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')


# Path to your image
image_path = "./040d7f00-7b5a-48b4-acf4-34621ca2b19c.jpg"
image_path = "./imgfull_230728093131.jpeg"
image_path = "./典型登革熱6大症狀-01.webp"

# Getting the base64 string
base64_image = encode_image(image_path)
details: list[str] = ["low", "high", "auto"]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role":
        "system",
        "content":
        "用繁體中文將給定圖片中的所有能辨識的文字資訊輸出，若圖片內沒有任何文字資訊則輸出'無內容'、並在最後分析這張圖片對其做解釋"
    }, {
        "role":
        "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}"
                }
            },
        ],
    }],
    max_tokens=1000,
    temperature=0,
    top_p=1,
    frequency_penalty=0)

print(response.choices[0].message.content)