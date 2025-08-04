from pydantic import BaseModel


class FormSkillConfig(BaseModel):
    description: str
    association_forms: list[str]
    examples: list[str]
    skill_message: str
    intention: str


a = {
    "intention": "設備故障報修專用技能",
    "description": "報修表單專用技能",
    "skill_message": "根據您的訊息，我為您找尋到下列相關表單:",
    "association_forms": ["網路故障報修單", "設備故障報修單", "設備故障報修進度查詢"],
    "examples":["滑鼠壞掉了","鍵盤沒反應","網路斷線","設備異常","設備報修","報修查詢"]
}
