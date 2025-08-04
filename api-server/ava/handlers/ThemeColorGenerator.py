from openai import OpenAI
from ava.utils import env_utils
import logging
from typing import Any

logger = logging.getLogger("ava_app")


class ThemeColorGenerator:

    def __init__(self):
        self.system_prompt = """
            我下面會輸入一個主題色的說明 資料裡面的格式長這樣
            不需要任何說明 只需要回覆給我純文本json的格式內容
            {
                "name": "disney",
                "remark": "迪士尼主題",
                "colors": {
                    "base": {
                        "primary": "#FFAA00",
                        "tertiary": "rgba(255, 170, 0, 0.3)",
                        "secondary": "#FFE600"
                    },
                    "topBar": {
                        "bg": "#FFAA00",
                        "text": "#FFFFFF"
                    },
                    "chatArea": {
                        "bg": "#FFE600",
                        "text": "#000000",
                        "userBg": "#FFFFFF",
                        "robotBg": "#FFAA00",
                        "userText": "#000000",
                        "robotText": "#FFFFFF",
                        "robotBtn": "#FF5733",
                        "robotBtnText": "#000000"
                    },
                    "inputArea": {
                        "bg": "#FFE600",
                        "text": "#000000"
                    },
                    "navigation": {
                        "bg": "#FFAA00",
                        "text": "#FFFFFF",
                        "roomActiveBg": "#FF5733"
                    }
                }
            }
            """

    def generate_theme_color(self, prompt: str) -> str:
        try:
            messages: list[dict[str, str]] = [{
                "role": "system",
                "content": self.system_prompt
            }, {
                "role": "user",
                "content": prompt
            }]

            client = OpenAI(api_key=env_utils.get_openai_key())

            response: Any = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,  # type: ignore
                max_tokens=1000,
                temperature=0.7)

            content: str = response.choices[0].message.content

            if content is None:
                raise Exception("Failed to generate theme colors")

            return content

        except Exception as ex:
            logger.error(f"Theme color generation error: {ex}")
            raise ex
