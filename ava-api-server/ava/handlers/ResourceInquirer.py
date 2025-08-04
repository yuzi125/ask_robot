import logging
import re
from datetime import datetime

import pytz
import requests
from kor.nodes import Object, Text
from langchain_openai import ChatOpenAI
from ava.handlers.AvaHandler import AvaHandler
from ..model.dscom import User
from ..utils import utils, env_utils
from ..utils import TimeSemanticExpressor as tse
from openai import OpenAI
from ava.utils.return_message_style import error_msg

from ava.utils.GPTHandler import GPTHandler

logger = logging.getLogger(__name__)


def get_current_time():
    now = datetime.now()
    hour = now.hour
    minute = 30 if now.minute >= 30 else 0
    return hour * 100 + minute


def split_time_to_hour(time_range, future=False):
    segments = time_range.split(",")
    new_segments = []
    current_time = get_current_time()
    for seg in segments:
        start, end = [int(t) for t in seg.split("-")]
        if not future:  # today
            if end < current_time and not future:
                continue
            if start < current_time:
                start = current_time
        if start != 1200:
            while start + 100 < end:
                if start not in [1130, 1200, 1230]:
                    new_segments.append(f"{start:04d}-{start + 100:04d}")
                if start == 1230:
                    start += 70
                else:
                    start += 100
            if start != end:
                new_segments.append(f"{start:04d}-{end:04d}")
    return ",".join(new_segments)


schema = Object(
    id="resource_inquirer",
    description="Resource information Inquirer",
    examples=[
        (
            "明天18樓還有哪些會議室可訂",
            [{
                "floor_id": "18",
                "date": "明天",
                "resource_type": "會議室",
            }],
        ),
        (
            "20樓還有哪些會議室",
            [{
                "floor_id": "20",
                "date": "今天",
                "resource_type": "會議室",
            }],
        ),
        (
            "週三19樓還有哪些會議室可訂",
            [{
                "floor_id": "19",
                "date": "週三",
                "resource_type": "會議室",
            }],
        ),
        (
            "明天上午還有會議室可以訂嗎?",
            [{
                "floor_id": "-",
                "date": "明天",
                "resource_type": "會議室",
            }],
        ),
        (
            "會議室",
            [{
                "floor_id": "-",
                "date": "X",
                "resource_type": "會議室",
            }],
        ),
        (
            "會議室?",
            [{
                "floor_id": "-",
                "date": "X",
                "resource_type": "會議室",
            }],
        ),
        (
            "明天下午18樓還有會議室可以訂嗎?",
            [{
                "floor_id": "18",
                "date": "明天",
                "resource_type": "會議室",
            }],
        ),
    ],
    attributes=[
        Text(
            id="floor_id",
            description="The id of the floor",
        ),
        Text(
            id="date",
            description="The date of the resource booking",
        ),
        Text(
            id="resource_type",
            description="The type of the resource booked",
        ),
    ],
    many=False,
)


def format_time(str):
    return str[:2] + ":" + str[2:]


def inquiry_resource(chat_uuid, expert_id, expert_model, user: User,
                     user_input, input_data):
    available_resources = input_data["resource_inquirer"]
    logger.info(f"before process: {input_data}")
    if len(available_resources) == 0:
        logger.error(f"available_resources: {available_resources}")
        raise ValueError("parsing available_resources error")

    # cookies = env_utils.get_test_cookies()
    for data in available_resources:
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Connection": "keep-alive",
        }
        date_str = data["date"]
        if date_str in [None, "-", "", "X"]:
            date_str = "今天"
        # 這邊是用來翻譯日期的
        # day = tse.convert_date(date_str, "")

        # 設定提示信息
        system_message = f"Below, one or more relative date terms such as 'tomorrow,' 'the day after tomorrow,' 'next Monday,' etc., will be provided. Based on today's date ({datetime.now()}), you need to calculate the specific dates corresponding to these relative date terms. If a term cannot be parsed, please return today's date instead, and do not include any additional explanation, only return the dates in the 'YYYYMMDD' format."

        # 使用GPT模型來轉譯日期
        messages = [
            {
                "role": "system",
                "content": system_message
            },
            {
                "role": "user",
                "content": f"{date_str}"
            },
        ]

        # 調用complete函數來得到轉換後的日期
        # day = complete(messages)

        GPT = GPTHandler(api_key=env_utils.get_openai_key())
        gpt_params = {
            "max_tokens": 1200,
            "temperature": 0,
            "frequency_penalty": 0,
            "top_p": 1.0,
        }
        expert_data = {
            "expert_id": expert_id,
            "expert_model": expert_model,
            "expert_model_type": "3",
        }
        day = GPT.run_gptModel(
            user,
            messages=messages,
            user_input=user_input,
            expert_data=expert_data,
            chat_uuid=chat_uuid,
            classify="relativeDateCalculationTask",
            model="gpt-4o",
            params=gpt_params,
        )

        # day = GPT.run_gptModel(
        #     user, messages=messages, model="gpt-4-0125-preview", params=gpt_params
        # )
        logger.info(f"day:{day}")

        icsc_host = env_utils.get_key("ICSC_HOST")
        url = f"https://{icsc_host}.icsc.com.tw/erp/ue/ajax?_controller=ueRecordSel&_action=Q&day={day}"
        # url = f"https://prod.icsc.com.tw/erp/ue/ajax?_controller=ueRecordSel&_action=Q&day={day}"
        logger.debug(f"url:{url}")
        response = requests.get(url,
                                headers=utils.decorate_header(user, headers))
        if "sso-logo.png" in response.text:
            raise ValueError("401")

    data = response.json()
    if data.get("data") is not None and data.get("data") == "":
        logger.error(f"error ueRecordSel: {data}")
        raise ValueError("Exceptioin occurred on querying. 500")
    floor_id = available_resources[0]["floor_id"][:2]
    filter = "*" if floor_id is None or floor_id == "-" else floor_id
    return filter_floor(filter, data, day), day


def filter_floor(filter, data, day):
    filter = "*" if filter is None else filter
    logger.info(f"filter_floor filter {filter}")
    ans = {}
    future = tse.is_future(day)
    logger.info(f"filter_floor data {data}")
    for date, rooms in data.items():
        for room, time_range in rooms.items():
            if room.startswith(filter + "F") or filter == "*":
                ans[room] = split_time_to_hour(time_range, future)
                # logger.info(f"{room}: {ans[room]}, time_range:{time_range}")
                # 18F-0001: 0730-0830,0830-0930,0930-1030,1030-1130,1300-1400,1400-1500,1500-1600,1600-1700,1700-1800, time_range:0730-1800
    sorted_keys = sorted(ans.keys())
    sorted_ans = {}
    for key in sorted_keys:
        sorted_ans[key] = ans[key]
    return sorted_ans


def build_form(last_chat):
    form = {
        "title":
        "會議室預約目的",
        "data": [
            {
                "name": "會議目的",
                "title": "請輸入會議室的使用目的",
                "required": False,
                "type": "text",
            },
            # {
            #     "type": "hidden",
            #     "data": last_chat
            # },
        ],
    }
    return form


def format_time_range(time_range):
    if time_range == "":
        return ""
    start, end = time_range.split("-")
    return f"{start[:2]}:{start[2:]}-{end[:2]}:{end[2:]}"


def format_data_for_ui(rooms, day_fmt="今天", query=""):
    cards = []
    for room, time_range in rooms.items():
        room = re.sub("F-00", "", room)
        items = []
        for seg in time_range.split(","):
            time_range = format_time_range(seg)
            if time_range != "":
                day_fmt = re.sub(r"\(.+\)", "", day_fmt)
                items.append({
                    "text": time_range,
                    "value": f"預約 {day_fmt} {time_range} {room} 會議室",
                })
        if len(items) > 0:
            card = {
                "id": room,
                "title": room + "會議室",
                "type": "single",
                "confirmAction": {
                    "color": "info",
                    "type": "button",
                    "text": "確定預約"
                },
                "form": build_form(query),
                "items": items
            }
            cards.append(card)
    return cards


class ResourceInquirer(AvaHandler):

    def get_intention(self):
        intention = "Retrieving information of meeting rooms available for booking."
        return intention

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        logger.info("Using Asking available meeting room...")
        logger.info(f"query{query}")
        logger.debug(
            f"ResourceInquirer self.llm model_name{self.llm.model_name}")

        # 11/17 langChain 0.0.336 更新的語法 參考 https://python.langchain.com/docs/use_cases/extraction
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                 expert_data, schema, query)

        # 舊的寫法
        # data = chain.predict_and_parse(text=query)["data"]
        logger.info(f"data parsed: {data}")
        available_time_segement, day = inquiry_resource(
            chat_uuid, expert_id, self.__class__.__name__, user, query, data)
        logger.info(f"available_time_segement: {available_time_segement}")
        logger.info(f"day: {day}")
        # 去除掉現在的時間以外的時間
        available_time_segement = self.filter_time_slots(
            available_time_segement, day)
        logger.info(f"available_time_segement{available_time_segement}")
        day_fmt = tse.date_to_short_format(day)
        cards = format_data_for_ui(available_time_segement, day_fmt, query)
        if len(cards) == 0:
            return "抱歉，" + day_fmt + " 已無會議室可預約。"
        else:
            return [
                day_fmt + "可預約時段如下: ",
                {
                    "type": "card"
                },
                {
                    "selection_mode": "single",
                    "data": cards,
                    "confirmAction": {
                        "color": "info",
                        "type": "button",
                        "text": "確定預約"
                    },
                },
            ]

    # TODO 這邊是硬接預約會議室功能 做法要改善
    def reserveMetting(self, chat_uuid, expert_id, user: User, input_data,
                       query):
        # 用於ResourceBooker預約會議室時 沒有填寫會議室ID或時間時 請他選擇的
        logger.info("Using Asking available meeting room reserveMetting...")
        logger.info(f"reserveMetting query: {query}")
        logger.info(f"reserveMetting input_data: {input_data}")

        date_str = input_data["date"]
        if date_str in [None, "-", "", "X"]:
            date_str = "今天"
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        query = (input_data["resource_id"] + " " + date_str + " " +
                 input_data["resource_type"] + " " +
                 input_data["booking_reason"])
        data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                 expert_data, schema, query)
        logger.info(f"reserveMetting data parsed: {data}")
        available_time_segement, day = inquiry_resource(
            chat_uuid, expert_id, self.__class__.__name__, user, query, data)
        # 去除掉現在的時間以外的時間
        available_time_segement = self.filter_time_slots(
            available_time_segement, day)
        logger.info(f"available_time_segement{available_time_segement}")
        day_fmt = tse.date_to_short_format(day)
        cards = format_data_for_ui(available_time_segement, day_fmt)
        if len(cards) == 0:
            return "抱歉，" + day_fmt + " 已無會議室可預約。"
        else:
            defaultText = input_data["booking_reason"]

            if defaultText in [None, "-", "", "X"]:
                defaultText = ""

            return [
                error_msg("缺少 會議室號碼 或 會議時間，\r\n\n ") + day_fmt + "可預約時段如下: ",
                {
                    "type": "card"
                },
                {
                    "form": {
                        "title":
                        "確認預約此會議室?",
                        "data": [
                            # {"text": input_data['booking_reason'],  "type": "view"},
                            {
                                "name": "主題:",
                                "title": "請輸入會議室的使用目的",
                                "required": False,
                                "type": "text",
                                "text": defaultText,
                            },
                            {
                                "type": "hidden",
                                "data": ""
                            },
                        ],
                    },
                    "data": cards,
                },
            ]

    def filter_time_slots(self, data, day):
        time_zone = env_utils.get_key("TZ")
        local_tz = pytz.timezone(time_zone)
        now = datetime.now(local_tz)
        current_date = now.strftime("%Y%m%d")
        # 如果不是今天就不刪除了
        if str(day) != current_date:
            return data
        current_hour = now.hour
        current_minute = now.minute

        current_time_str = f"{str(current_hour).zfill(2)}{str(current_minute).zfill(2)}"
        logger.info(f"current_time_str: {current_time_str}")
        try:
            current_time = int(current_time_str)  # 將當前時間轉換為整數形式
        except Exception as e:
            logger.error(f"無法將時間字符串轉換為整數：{current_time_str}. 錯誤：{e}")
            # 根據您的需求處理錯誤，例如：設定一個默認值或返回一個錯誤信息
            logger.debug(f"filter_time_slots time_zone: {time_zone}")

            logger.debug(f"filter_time_slots local_tz: {local_tz}")
            logger.debug(f"filter_time_slots now: {now}")
            logger.debug(f"filter_time_slots current_date: {current_date}")
            return None  # 或者是其他合適的處理方式
        logger.info(f"current_time: {current_time}")

        filtered_data = {}
        filtered_data = {}
        for key, time_slots in data.items():
            new_time_slots = []
            if time_slots:  # 檢查 time_slots 是否為空
                for time_slot in time_slots.split(","):
                    if time_slot:  # 再次確保 time_slot 不為空
                        start_time, end_time = map(int, time_slot.split("-"))
                        if end_time >= current_time:
                            new_time_slots.append(time_slot)

            filtered_data[key] = ",".join(new_time_slots)

        return filtered_data

    def return_directly(self):
        return True

    def get_examples(self) -> list:
        return [
            "18樓還有哪些會議室",
            "今天還有哪些會議室",
        ]

    def get_intention_type(self):
        return "Q,E"


def test():
    data = {
        "07/24(一)": {
            "18F-0001": "0730-0800,0900-1800",
            "18F-0002": "0730-1000,1300-1800",
            "18F-0003": "0730-0800,1000-1800",
            "18F-0004": "0730-1800",
            "19F-0001": "0730-0800,0900-1800",
            "19F-0002": "0730-1800",
            "19F-0003": "0730-1400,1600-1800",
            "19F-0004": "0730-1400,1600-1800",
            "19F-0005": "0730-1800",
            "19F-0006": "0730-1800",
            "20F-0001": "0730-1800",
            "20F-0002": "0730-1800",
            "20F-0003": "0730-1800",
            "20F-0004": "0730-1800",
            "20F-0005": "0730-1800",
            "20F-0006": "0730-1800",
            "20F-0007": "0730-1800",
            "20F-0008": "0730-1800",
            "webex01": "0730-1800",
        }
    }
    ans = filter_floor("18", data)
    logger.info(ans)


# test()
# print(split_time_to_hour("0730-0800,0900-1800"))

# result = split_time_to_hour("0730-1800", True)
#
# print(result)
