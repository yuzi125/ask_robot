import logging
import re

import requests
from bs4 import BeautifulSoup
from kor import Object, Text

from ava.handlers.ICSCWebAPI import ICSCWebAPI
from ava.model.dscom import User
from ava.session.ICSCSession import ICSCSession
from ava.utils import data_utils
from ava.utils.TimeSemanticExpressor import convert_leave_date_time

logger = logging.getLogger(__name__)

leave_code_dic = {
    '休假': 'A',
    '病假': 'B',
    '公假': 'C',
    '事假': 'D',
    '婚假': 'E',
    '喪假': 'F',
    '分娩假': 'G',
    '家庭照顧假': 'P'
}


def build_form(last_chat, reason, lv_text):
    form1 = {
        "title": "請補充請假資料",
        "data": [
            {"type": "hidden", "data": last_chat},
        ],
    }
    if "請假" in reason or data_utils.is_empty(reason):
        form1["data"].append({"name": "請假事由", "title": "請輸入請假事由", "required": True, "type": "text"}, )
    if data_utils.is_empty(lv_text):
        form1["data"].append({
            "name": "假別",
            "title": "請輸入請假假別",
            "required": True,
            "type": "select",
            "option": [
                {"show": "休假", "value": "休假"},
                {"show": "病假", "value": "病假"},
                {"show": "事假", "value": "事假"},
                {"show": "公假", "value": "公假"},
                {"show": "婚假", "value": "婚假"},
                {"show": "家庭照顧假", "value": "家庭照顧假"},
            ],
        })
    return {"type": "form", "data": form1}


class ICSC_hdjjb01A(ICSCWebAPI):

    def get_intention(self):
        intention = "Apply for leave."
        return intention

    def get_data_schema(self, query):
        return Object(
            id="leave_record",
            description="Leave apply information",
            examples=[
                (
                    "下週三家中有事，請休假一天", [{
                        "from_date": "下週三",
                        "from_time": "",
                        "to_date": "下週三",
                        "to_time": "",
                        "lv_code": "休假",
                        "reason_desc": "家中有事"
                    }]
                ),
                (
                    "下週一要請假一天", [{
                        "from_date": "下週一",
                        "from_time": "",
                        "to_date": "下週一",
                        "to_time": "",
                        "lv_code": "",
                        "reason_desc": ""
                    }]
                ),
                (
                    "週一家裡要修水電，請假一天", [{
                        "from_date": "週一",
                        "from_time": "",
                        "to_date": "週一",
                        "to_time": "",
                        "lv_code": "",
                        "reason_desc": "家裡要修水電"
                    }]
                ),
                (
                    "下週三8點到12點請休假，辦理家庭事務", [{
                        "from_date": "下週三",
                        "from_time": "8點",
                        "to_date": "下週三",
                        "to_time": "12點",
                        "lv_code": "休假",
                        "reason_desc": "辦理家庭事務"
                    }]
                ),
                (
                    "因為要出國旅遊，會在6/22到6/24請休假休息一下", [{
                        "from_date": "6/22",
                        "from_time": "",
                        "to_date": "6/24",
                        "to_time": "",
                        "lv_code": "休假",
                        "reason_desc": "出國旅遊"
                    }]
                ),
                (
                    "需要請上午的假，家裡有事要處理", [{
                        "from_date": "今天",
                        "from_time": "X",
                        "to_date": "今天",
                        "to_time": "X",
                        "lv_code": "事假",
                        "reason_desc": "家裡有事要處理"
                    }]
                ),
                (
                    "需要請下午的假，身體不適休息一下", [{
                        "from_date": "今天",
                        "from_time": "X",
                        "to_date": "今天",
                        "to_time": "X",
                        "lv_code": "",
                        "reason_desc": "身體不適休息一下"
                    }]
                ),
                (
                    "下周二上午要申請休假，有事辦理", [{
                        "from_date": "下周二",
                        "from_time": "X",
                        "to_date": "下周二",
                        "to_time": "X",
                        "lv_code": "休假",
                        "reason_desc": "有事辦理"
                    }]
                )

            ],
            attributes=[
                Text(
                    id="from_date",
                    description="The date when the leave begins.",
                ),
                Text(
                    id="from_time",
                    description="The time without date when the leave begins.",
                ),
                Text(
                    id="to_date",
                    description="The date without time when the leave ends.",
                ),
                Text(
                    id="to_time",
                    description="The time without date when the leave ends.",
                ),
                Text(
                    id="lv_code",
                    description="The type of leave",
                ),
                Text(
                    id="reason_desc",
                    description="More detailed description about this leave application",
                )
            ],
            many=False,
        )

    def post(self,chat_uuid, expert_data,  user: User, input_data, query):
        data = input_data[0]
        logger.info(f"請假參數: {data}")

        reason_desc = data['reason_desc']
        lv_text = data['lv_code']

        if reason_desc in leave_code_dic:
            lv_text = reason_desc
            query += " 假別:" + lv_text
            reason_desc = ""

        logger.debug("假別:" + lv_text + " 事由:" + reason_desc)

        if ("請假" in reason_desc or data_utils.is_empty(reason_desc)) or data_utils.is_empty(lv_text):
            return build_form(query, reason_desc, lv_text)

        logger.debug("假別:" + lv_text)
        data_utils.assert_not_empty(lv_text, "請問您的休假假別是(休假,病假,事假...)?")
        data_utils.assert_not_equal(data['from_time'], data['to_time'],
                                    f"請假起迄時間資訊不足({data['from_time']}~{data['to_time']})，請再補充")

        lv_code = leave_code_dic[lv_text]

        # assert len(input_data) == 1, "error in extracting extension number"
        icsc_session = ICSCSession(user, requests.Session())
        resp = icsc_session.post(self.get_host_url() + "/erp/hd/do?_pageId=hdjjb01A&_action=I2", {})
        pre_leave_data = resp.json()
        logger.info(f"pre_leave_data{pre_leave_data}")
        agent_userId = pre_leave_data["agent_userId"]
        toSir_userId = pre_leave_data['toSir_userId']
        # shift = pre_leave_data['shift']
        if agent_userId == "X" or agent_userId == "" or agent_userId is None:
            return "檢測到前一筆假單代理人有錯誤，無法自動請假，請自行至系統處理請假"
        if toSir_userId == "X" or toSir_userId == "" or toSir_userId is None:
            return "檢測到前一筆假單沒有呈送主管，無法自動請假，請自行至系統處理請假"
        if data['from_date'] == "X" or data['from_date'] == "" or data['from_date'] is None:
            return "沒有提供請假開始日期，你可以這樣跟我說: 明天請一天事假7:30~16:30，家裡有事要辦理"
        if data['from_time'] == "X" or data['from_time'] == "" or data['from_time'] is None:
            return "沒有提供請假開始時間，你可以這樣跟我說: 明天請一天事假7:30~16:30，家裡有事要辦理"
        if data['to_date'] == "X" or data['to_date'] == "" or data['to_date'] is None:
            return "沒有提供請假結束日期，你可以這樣跟我說: 明天請一天事假7:30~16:30，家裡有事要辦理"
        if data['to_time'] == "X" or data['to_time'] == "" or data['to_time'] is None:
            return "沒有提供請假結束時間，你可以這樣跟我說: 明天請一天事假7:30~16:30，家裡有事要辦理"
        if data['lv_code'] == "X" or data['lv_code'] == "" or data['lv_code'] is None:
            return "沒有提供請假類別，請提供請假類別 你可以這樣跟我說: 明天請一天事假7:30~16:30，家裡有事要辦理"

        from_date, from_time, to_date, to_time = convert_leave_date_time(data['from_date'], data['from_time'],
                                                                         data['to_date'],
                                                                         data['to_time'])
        post_data = {
            'empNo_v1': user.userNo,  # 工號
            'agentEmpNo_v1': agent_userId,  # 代理人
            'infoEmp_v1': '',  # 通知人
            'infoGroup_v1': '',
            'lvCode_v1': lv_code,  # 假別
            'reasonDesc_v1': reason_desc,  # 請假說明
            'lvReason_v1': '',  # 事由
            'reasonDate_v1': '',  # 發生日
            'fromDate_v1': from_date,  # 起 日期
            'fromTime_v1': from_time,  # 起 時間
            'toDate_v1': to_date,
            'toTime_v1': to_time,
            'sentSirA_qry': toSir_userId,  # 主管
            'compId_v1': user.login_info["icsc_sso"]["compNo"],
            'depNo_v1': user.login_info["icsc_sso"]["depNo"],
            'formId_v1': '+',
            'nextOp_v1': toSir_userId,
            'nowUser': user.userNo,
            'sentSirB_qry': toSir_userId,
            '_action': 'A',
            'shiftIdU_v1': '04'  # default 08:30-17:30
        }

        post_url = self.get_host_url() + "/erp/hd/do?_pageId=hdjjb01A"
        resp = icsc_session.post(post_url, post_data)

        soup = BeautifulSoup(resp.text, 'html.parser')
        element = soup.find('td', {'class': 'msg'})
        if element:
            msg = element.text.replace(r"icsc_.+$", "")
            msg = re.sub(r"icsc_.+$", "", msg)
        else:
            logger.warning(f"resp.text:{resp.text}")
            msg = "送出異常，請洽管理員"
        to_date_str = ""
        if from_date != to_date:
            to_date_str = to_date + " "
        apply_msg = f"*{from_date} {from_time}~{to_date_str}{to_time} {reason_desc} {lv_text}*\n- {msg}"
        logger.info(f"apply_msg{apply_msg}")
        return apply_msg

    def get_examples(self) -> list:
        return [
            "我想請6/23到6/25的休假辦理私務",
            "臨時有事，需要請今天下午1點到5點的事假",
            "下週一家裡要修水電，請休假一天",
            "下週四要請假一天",
        ]
