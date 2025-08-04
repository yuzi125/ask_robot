import logging
import re

import requests
from ava.handlers.AvaHandler import AvaHandler
from ava.handlers.ResourceInquirer import ResourceInquirer
from ava.model.dscom import User
from ava.utils import env_utils, utils
from ava.utils.GPTHandler import GPTHandler
from ava.utils.return_message_style import error_msg, warn_msg
from ava.utils.TimeSemanticExpressor import convert_date_time
from bs4 import BeautifulSoup
from kor.nodes import Object, Text
from langchain_openai import ChatOpenAI

logger = logging.getLogger("ava_app")


def convert_to_time(datetime_data):
    # Convert the given datetime_data to a string
    datetime_str = str(datetime_data)
    return datetime_str[-4:-2] + ":" + datetime_str[-2:]


def resource_type_mapping(data):
    if data == "" or data == None or data in "會議室":
        return "ROOM"
    if data == "webex":
        return "VEDIOCONF"


schema = Object(
    id="booking_record",
    description="Resource booking information",
    examples=[
        (
            "預約 6/20 的1802會議室，review專案工作進度，時間是3點~5點",
            [{
                "resource_id": "1802",
                "date": "6/20",
                "booking_from": "下午3點",
                "booking_to": "下午5點",
                "resource_type": "會議室",
                "booking_reason": "review專案工作進度",
            }],
        ),
        (
            "預約 1月10日 8:00~18:00 1801會議室，S22工作會議",
            [{
                "resource_id": "1801",
                "date": "1/10",
                "booking_from": "08:00",
                "booking_to": "18:00",
                "resource_type": "會議室",
                "booking_reason": "S22工作會議",
            }],
        ),
        (
            "預約明天的1802會議室，10:00~9:00 討論專案管理",
            [{
                "resource_id": "1802",
                "date": "明天",
                "booking_from": "9:00",
                "booking_to": "10:00",
                "resource_type": "會議室",
                "booking_reason": "專案管理",
            }],
        ),
        (
            "預約下禮拜一的1802會議室，10~8 專案進度討論",
            [{
                "resource_id": "1802",
                "date": "下禮拜一",
                "booking_from": "8:00",
                "booking_to": "10:00",
                "resource_type": "會議室",
                "booking_reason": "專案進度討論",
            }],
        ),
        (
            "預約11/2 16:00後 1804會議室",
            [{
                "resource_id": "1804",
                "date": "11/2",
                "booking_from": "下午4點",
                "booking_to": "X",
                "resource_type": "會議室",
                "booking_reason": "X",
            }],
        ),
        (
            "預約16:00 18樓會議室",
            [{
                "resource_id": "X",
                "date": "今天",
                "booking_from": "下午4點",
                "booking_to": "X",
                "resource_type": "會議室",
                "booking_reason": "X",
            }],
        ),
        (
            "預約17:00 19樓會議室",
            [{
                "resource_id": "X",
                "date": "今天",
                "booking_from": "下午5點",
                "booking_to": "X",
                "resource_type": "會議室",
                "booking_reason": "X",
            }],
        ),
        (
            "預約 7/5 9點~10點的1801會議室，討論工作遇到問題",
            [{
                "resource_id": "1801",
                "date": "7/5",
                "booking_from": "9點",
                "booking_to": "10點",
                "resource_type": "會議室",
                "booking_reason": "討論工作遇到問題",
            }],
        ),
        (
            "預約明天8點到9點 1802, 要開專案進度追蹤會議",
            [{
                "resource_id": "1802",
                "date": "明天",
                "booking_from": "8點",
                "booking_to": "9點",
                "resource_type": "會議室",
                "booking_reason": "開專案進度追蹤會議",
            }],
        ),
        (
            "預約今天 14:00-15:00 2002 會議室, 討論專案工作",
            [{
                "resource_id": "2002",
                "date": "今天",
                "booking_from": "下午2點",
                "booking_to": "下午3點",
                "resource_type": "會議室",
                "booking_reason": "討論專案工作",
            }],
        ),
        (
            "預約明天10點到12點1802會議室,webex，跟遠傳開視訊會議",
            [
                {
                    "resource_id": "1802",
                    "date": "明天",
                    "booking_from": "10點",
                    "booking_to": "12點",
                    "resource_type": "會議室",
                    "booking_reason": "跟遠傳開視訊會議",
                },
                {
                    "resource_id": "webex",
                    "date": "明天",
                    "booking_from": "10點",
                    "booking_to": "12點",
                    "resource_type": "webex",
                    "booking_reason": "跟遠傳開視訊會議",
                },
            ],
        ),
        (
            "幫我預約1801會議室 討論AVA專案",
            [{
                "resource_id": "1801",
                "date": "-",
                "booking_from": "X",
                "booking_to": "X",
                "resource_type": "會議室",
                "booking_reason": "討論AVA專案",
            }],
        ),
        (
            "預約會議室",
            [{
                "resource_id": "-",
                "date": "今天",
                "booking_from": "X",
                "booking_to": "X",
                "resource_type": "會議室",
                "booking_reason": "-",
            }],
        ),
    ],
    attributes=[
        Text(
            id="resource_id",
            description="The id of the resource",
        ),
        Text(
            id="date",
            description="The date of the resource booking",
        ),
        Text(
            id="booking_from",
            description="The time of the resource booking from,",
        ),
        Text(
            id="booking_to",
            description="The time of the resource booking to",
        ),
        Text(
            id="resource_type",
            description="The type of the resource booked",
        ),
        Text(
            id="booking_reason",
            description="The reason of this resource booking",
            examples=[("Songs by paul simon", "paul simon")],
        ),
    ],
    many=True,
)


def data_mapping(data):
    ptn = r"\d{4}"
    if re.match(ptn, data):
        return data[:2] + "F-00" + data[2:]

    if data == "webex":
        return "Vedio_1"

    return None


class ResourceBooker(AvaHandler):

    def __init__(self, llm: ChatOpenAI, skill_id: str, skill_name: str):
        super().__init__(llm, skill_id, skill_name)
        self.skill_id = skill_id
        self.skill_name = skill_name
        self.resource_inquirer = ResourceInquirer(llm, skill_id, skill_name)

    def get_intention(self):
        intention = (
            "Request for Booking Shared Company Resources (such as meeting room)"
        )
        return intention

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        logger.info("Using Resource handler...")
        logger.info(f"query: {query}")

        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                 expert_data, schema, query)
        logger.info(f"data parsed: {data}")
        msg = self.post_resource_service(chat_uuid, expert_id, user, data,
                                         query)
        return msg

    def post_resource_service(self, chat_uuid, expert_id, user: User,
                              input_data, query):
        element = ""
        message = ""
        icsc_host = env_utils.get_key("ICSC_HOST")
        url = f"https://{icsc_host}.icsc.com.tw/erp/ue/jsp/uejjwfchart.jsp"
        # url = 'https://prod.icsc.com.tw/erp/ue/jsp/uejjwfchart.jsp'
        booking_resources = input_data["booking_record"]
        if len(booking_resources) == 0:
            # raise ValueError("與openai傳輸出了點問題，請稍後再試。 error code: parsing booking_record error")
            booking_resources = [{
                "resource_id": "-",
                "date": "今天",
                "booking_from": "X",
                "booking_to": "X",
                "resource_type": "會議室",
                "booking_reason": "-",
            }]

        logger.info(f"before process: {input_data}")

        booking_info_list = []
        for data in booking_resources:
            if data["resource_id"] in [None, "-", "", "X"]:
                available_rooms = self.resource_inquirer.reserveMetting(
                    chat_uuid, expert_id, user, data, query)
                return available_rooms
            if data["booking_from"] in [None, "-", "", "X"]:
                available_rooms = self.resource_inquirer.reserveMetting(
                    chat_uuid, expert_id, user, data, query)
                return available_rooms
            if data["booking_reason"] in [None, "-", "", "X"]:
                data["booking_reason"] = "臨時會議"
            from_time, to_time = convert_date_time(data["date"],
                                                   data["booking_from"],
                                                   data["booking_to"])
            # cookies = env_utils.get_test_cookies()
            # logging.debug("test cookies: %s", cookies)
            if from_time > to_time:
                temp = from_time
                from_time = to_time
                to_time = temp

            logger.info(
                f"convert_date_time from_time to_time: {from_time} {to_time}")
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Connection": "keep-alive",
            }
            logger.info(f"user:{user}")
            post_data = {
                "type": resource_type_mapping(data["resource_type"]) or "ROOM",
                "itemID": data_mapping(data["resource_id"]),  # 18F-0002
                "alreadFillDesc": "ok",
                "doAction": "ok",
                "itemName": data["resource_id"],  # 會議室
                "itemGroupID": "icsc",
                "descColumn1": data["booking_reason"],
                "descColumn2": "",
                "descColumn3": "00000",
                "date": from_time[:7],
                "reserveFrom": from_time,
                "reserveTo": to_time,
                "fromTime": convert_to_time(from_time),
                "toTime": convert_to_time(to_time),
                "chairman": user.userNo,
                "meetingSubject": data["booking_reason"],
            }

            logger.info(f"request:{post_data}")

            response = requests.post(url,
                                     data=post_data,
                                     headers=utils.decorate_header(
                                         user, headers))

            if "sso-logo.png" in response.text:
                logging.debug("response: \n" + response.text)
                raise ValueError("401")
            # if (response.status_code != 200):
            #     return "會議預約失敗，ERP出現錯誤，無法自動預約，請檢察您的預約時間與日期是否小於現在時間，或者會議室號碼是否有誤"
            logger.info(response.status_code)
            # print(response.text)

            # 解析HTML以獲取預約訊息
            soup = BeautifulSoup(response.text, "html.parser")
            element = soup.find("table", {"id": "tbl1"})
            if element:
                rows = element.find_all("tr")
                if len(rows) > 1:
                    td_elements = rows[1].find_all("td")
                    if len(td_elements) >= 4:
                        message = td_elements[3].text
                        logger.info(message)  # 輸出：該時段已有其他預約紀錄，請重新預約!
            # print("element"+element)

            # 將每次預約的訊息新增到列表中
            booking_info = {
                "date": f"{from_time[3:5]}/{from_time[5:7]}",
                "startTime": self.parse_time_str(from_time),
                "endTime": self.parse_time_str(to_time),
                "reason": data["booking_reason"],
            }
            booking_info_list.append(booking_info)

        # 組合最後的返回訊息

        booking_summary = "為您預約：" + data["resource_id"] + " 會議室\r\n"
        for info in booking_info_list:
            booking_summary += f"\n{info['date']} {info['startTime']}~{info['endTime']} 主題: {info['reason']}"
        if "SQLCODE" in message:
            message = "會議預約失敗，ERP出現錯誤，無法自動預約，請檢察您的預約時間與日期是否小於現在時間，或者會議室號碼是否有誤"

        return [(booking_summary + " \r\n\n 伺服器訊息 ： " +
                 warn_msg(message if message else "ERP錯誤，無提供訊息，請自行確認是否預約成功"))]

    def parse_time_str(self, input_str):
        # year = input_str[:3]
        # month = input_str[3:5]
        # day = input_str[5:7]
        hour = input_str[7:9]
        minute = input_str[9:11]

        parsed_str = f"{hour}:{minute}"
        # parsed_str = f"{year}年 {month}月 {day}日 {hour}:{minute}"
        return parsed_str

    def parse_date_time_str(self, input_str):
        # year = input_str[:3]
        month = input_str[3:5]
        day = input_str[5:7]
        hour = input_str[7:9]
        minute = input_str[9:11]

        parsed_str = f"{month}/{day} {hour}:{minute}"
        # parsed_str = f"{year}年 {month}月 {day}日 {hour}:{minute}"
        return parsed_str

    def get_examples(self) -> list:
        return [
            "預約明天8點到9點的1802會議室",
            "預約下週一的下午的公務車",
        ]

    def return_directly(self):
        return True
