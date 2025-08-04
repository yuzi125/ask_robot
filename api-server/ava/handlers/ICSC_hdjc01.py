import logging
import re

import requests
from ava.handlers.AvaHandler import AvaHandler
from ava.handlers.ResourceInquirer import ResourceInquirer
from ava.handlers.skills.SkillConfigLoader import load_skill_config
from ava.handlers.skills.WebAPIConfig import WebAPIConfig
from ava.model.dscom import User
from ava.utils import env_utils, utils
from ava.utils.return_message_style import error_msg
from ava.utils.TimeSemanticExpressor import convert_date_time
from bs4 import BeautifulSoup
from kor.extraction import create_extraction_chain
from kor.nodes import Object, Text
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)


def loadConfig() -> WebAPIConfig:
    skill_configs = load_skill_config()
    return skill_configs['hdjjc01']


def convert_to_time(datetime_data):
    # Convert the given datetime_data to a string
    datetime_str = str(datetime_data)
    return datetime_str[-4:-2] + ":" + datetime_str[-2:]


def resource_type_mapping(data):
    if data == "" or data == None or data in "會議室":
        return "ROOM"
    if data == "webex":
        return "VEDIOCONF"


config: WebAPIConfig = loadConfig()

schema = config.schema.get_kor_definition()


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

    def parse_input(self, query):
        chain = create_extraction_chain(self.llm, schema)
        data = chain.invoke(query)["data"]
        return data

    def get_intention(self):
        intention = (
            "Request for Booking Shared Company Resources (such as meeting room)"
        )
        return intention

    def handle(self, user: User, query, chat_context: list):
        self.auth_user_login_type(user)
        logger.info("Using Resource handler...")
        logger.info(query)
        data = self.parse_input(query)
        logger.info(f"data parsed: {data}")
        msg = self.post_resource_service(user, data, query)
        return msg

    def post_resource_service(self, user: User, input_data, query):
        element = ""
        message = ""
        icsc_host = env_utils.get_key("ICSC_HOST")
        url = f"https://{icsc_host}.icsc.com.tw/erp/ue/jsp/uejjwfchart.jsp"
        # url = 'https://prod.icsc.com.tw/erp/ue/jsp/uejjwfchart.jsp'
        booking_resources = input_data["booking_record"]
        if len(booking_resources) == 0:
            raise ValueError("parsing booking_record error")

        logger.info(f"before process: {input_data}")

        booking_info_list = []
        for data in booking_resources:
            if data["resource_id"] in [None, "-", "", "X"]:
                available_rooms = self.resource_inquirer.reserveMetting(
                    user, data, query)
                return available_rooms
            if data["booking_from"] in [None, "-", "", "X"]:
                available_rooms = self.resource_inquirer.reserveMetting(
                    user, data, query)
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
            post_data = {
                "type": resource_type_mapping(data["resource_type"]) or "ROOM",
                "itemID": data_mapping(data["resource_id"]),  # 18F-0002
                "alreadFillDesc": "ok",
                "doAction": "ok",
                "itemName": data["resource_id"],  # 會議室
                "itemGroupID": "icsc",
                "descColumn1": data["booking_reason"],
                "descColumn2": "",
                "descColumn3": "35617",
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

        return (booking_summary + " \r\n\n 伺服器訊息 ： " +
                error_msg(message if message else "ERP錯誤，無提供訊息，請自行確認是否預約成功"))

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
