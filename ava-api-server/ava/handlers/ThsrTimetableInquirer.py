import logging
from urllib.error import HTTPError
from langchain_openai import ChatOpenAI
from kor.nodes import Object, Text

from ava.handlers.AvaHandler import AvaHandler
from ..model.dscom import User
from ..tools import TransportDataQuerySkill as tdx
from ..utils.TimeSemanticExpressor import chinese_time_to_formatted_number, convert_date


from ava.utils.GPTHandler import GPTHandler

logger = logging.getLogger(__name__)


class ThsrTimetableInquirer(AvaHandler):

    def get_intention(self):
        intention = "Inquire about high-speed train schedules or timings."
        return intention

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        logger.info("Using THSR Timetable handler...")
        schema = Object(
            id="thsr_timetable_inquiry",
            description="Inquiry High Speed Railway Timetable",
            examples=[
                (
                    "明天左營到台中，10點前可抵達的高鐵班次",
                    [{
                        "date": "明天",
                        "arrival_before": "10點",
                        "start_station_name": "左營",
                        "end_station_name": "台中",
                    }],
                ),
                (
                    "7月22號台北到高雄，晚上8點前可抵達的高鐵班次",
                    [{
                        "date": "7/22",
                        "arrival_before": "晚上8點",
                        "start_station_name": "台北",
                        "end_station_name": "高雄",
                    }],
                ),
                (
                    "8月13號到9點半前到台中高鐵有哪些班次",
                    [{
                        "date": "8/13",
                        "arrival_before": "9點半",
                        "start_station_name": "左營",
                        "end_station_name": "台中",
                    }],
                ),
                (
                    "明天10點半前到台北的高鐵班次有哪些",
                    [{
                        "date": "明天",
                        "arrival_before": "10點半",
                        "start_station_name": "左營",
                        "end_station_name": "台北",
                    }],
                ),
                (
                    "後天9點半前到達台北的高鐵有哪些班次",
                    [{
                        "date": "後天",
                        "arrival_before": "9點半",
                        "start_station_name": "左營",
                        "end_station_name": "台北",
                    }],
                ),
                (
                    "幫我查週三台北到新竹，12點前可抵達的高鐵班次",
                    [{
                        "date": "週三",
                        "arrival_before": "12點",
                        "start_station_name": "台北",
                        "end_station_name": "新竹",
                    }],
                ),
            ],
            attributes=[
                Text(
                    id="date",
                    description="The date of the ride",
                ),
                Text(
                    id="arrival_before",
                    description="The time before arrival",
                ),
                Text(
                    id="start_station_name",
                    description="Name of departure station",
                ),
                Text(
                    id="end_station_name",
                    description="Name of arrival station",
                ),
            ],
            many=True,
        )
        # data = GPTHandler.run_gptModel_langChain(user,self.llm,schema,query)
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        data = GPTHandler.run_gptModel_langChain(chat_uuid, user, self.llm,
                                                 expert_data, schema, query)

        logger.info(f"data parsed: {data}")
        thsr_query = data["thsr_timetable_inquiry"][0]
        arrival_before = chinese_time_to_formatted_number(
            thsr_query["arrival_before"], delimiter=":")
        date = convert_date(thsr_query["date"], delimiter="-")
        start_station_name = thsr_query["start_station_name"]
        if start_station_name is None:
            start_station_name = "左營"

        try:
            msg = tdx.get_suitable_train(date, start_station_name,
                                         thsr_query["end_station_name"],
                                         arrival_before)
        except HTTPError as e:
            return e.msg

        return msg

    def return_directly(self):
        return True

    def get_intention_type(self):
        return "Q,E"
