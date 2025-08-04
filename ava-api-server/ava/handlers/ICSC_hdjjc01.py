import requests
from bs4 import BeautifulSoup
from kor import Object, Text

from ava.handlers.ICSCWebAPI import ICSCWebAPI
from ava.model.dscom import User
from ava.session.ICSCSession import ICSCSession
from ava.utils import data_utils
from ava.utils.TimeSemanticExpressor import *

logger = logging.getLogger(__name__)
milestone_options = """
- A 拜訪客戶及備標階段
- B 專案規劃及管理
- C 需求規劃及分析階段
- D 設計及開發階段
- E 試車及整體測試階段
- F 上線運行保駕階段
- G 保固維護階段-需求處理
- H 保固維護階段-問題處理
- I 設備及線路之安裝、維護及保養等
- J 業務需要排班之固定性加班
- K 處理其他臨時指派之緊急任務
- L 緊急搶修
"""


def get_milestone_text(code):
    # Split the string into lines
    mapping = convert_milestone_dict()
    return mapping.get(code)


def convert_milestone_dict():
    lines = milestone_options.strip().split("\n")
    # Create a dictionary to map codes to their texts
    mapping = {}
    for line in lines:
        key, value = line[2:].split(' ')  # Split at the first space
        mapping[key] = value.strip()  # Remove extra spaces from value
    return mapping


milestone_mapping = convert_milestone_dict()


def guess_milestone(text):
    for key, value in milestone_mapping.items():
        if text in value:
            return key
    raise AssertionError(f"里程:{text} not found")


def get_msg(soup: BeautifulSoup):
    element = soup.find('td', {'class': 'msg'})
    msg = element.text.replace(r"icsc_.+$", "")
    return re.sub(r"icsc_.+$", "", msg)


class ICSC_hdjjc01(ICSCWebAPI):


    def get_intention(self):
        return "Apply for Overtime Work Allowance"

    def get_data_schema(self, query):
        return Object(
            id="apply_overtime_work_allowance",
            description="Apply for Overtime Work Allowance",
            examples=[
                (
                    "預計5點到6點加班1小時，準備系統整體測試工作 A", [{
                        "from_date": "今天",
                        "from_time": "5點",
                        "to_date": "今天",
                        "to_time": "6點",
                        "ov_hrs": "1",
                        "reason_desc": "準備系統整體測試工作",
                        "milestone": "A",
                    }]
                ),
                (
                    "計劃明天8點到17點加班8小時，B 興達海基切換上線保駕", [{
                        "from_date": "明天",
                        "from_time": "8點",
                        "to_date": "明天",
                        "to_time": "17點",
                        "ov_hrs": "8",
                        "reason_desc": "興達海基切換上線保駕",
                        "milestone": "B",
                    }]
                ),
                (
                    "為了中保切換上線保駕，下週六下午1點到5點預計加班3小時 設計", [{
                        "from_date": "下週六",
                        "from_time": "下午1點",
                        "to_date": "下週六",
                        "to_time": "下午5點",
                        "ov_hrs": "3",
                        "reason_desc": "為了中保切換上線保駕",
                        "milestone": "設計",
                    }]
                )
            ],
            attributes=[
                Text(
                    id="from_date",
                    description="The date when the overtime begins.",
                ),
                Text(
                    id="from_time",
                    description="The time when the overtime begins.",
                ),
                Text(
                    id="to_date",
                    description="The date when the overtime ends.",
                ),
                Text(
                    id="to_time",
                    description="The time when the overtime ends.",
                ),
                Text(
                    id="ov_hrs",
                    description="duration of overtime",
                ),
                Text(
                    id="reason_desc",
                    description="description of overtime",
                ),
                Text(
                    id="milestone",
                    description="milestone of overtime",
                )
            ],
            many=False,
        )

    def post(self,chat_uuid, expert_data,  user: User, input_data, query):
        assert len(input_data)>0, "預申請加班無輸入資料"
        data = input_data[0]
        from_date, from_time_input, to_date, to_time_input = convert_leave_date_time(data['from_date'],
                                                                                     data['from_time'],
                                                                                     data['to_date'],
                                                                                     data['to_time'])
        from_time_input, to_time_input = adjust_from_to(from_time_input, to_time_input)

        ovHrs = data['ov_hrs']
        reason_desc = data['reason_desc']
        milestone = data['milestone']
        if not bool(re.match('^[A-Z]+$', milestone)):
            milestone = guess_milestone(milestone)

        data_utils.assert_not_empty(reason_desc, "請輸入預加班事由")
        icsc_session = ICSCSession(user, requests.Session())
        # if data_utils.is_empty(milestone):
        resp = icsc_session.post(self.get_host_url() + "/erp/hd/do?_pageId=hdjjc05A&_action=IN", {
            "empNoHid_qry": user.userNo
        })
        assert resp.status_code == 200, "error in query previous record of hdjjc05A"
        soup = BeautifulSoup(resp.text, 'html.parser')
        if not milestone:
            element = soup.find('select', id='reasonCode_v1')
            if element:
                selected_option = element.find('option', selected=True)
                if selected_option:
                    milestone = selected_option['value']
                else:
                    raise AssertionError("*請輸入專案里程(英文字母)*:\n" + milestone_options)

        boss_element = soup.find('input', id='boss_v1')
        if not boss_element:
            raise ValueError("'boss_v1' not found in html.")

        boss_v1 = boss_element['value']
        post_url = self.get_host_url() + "/erp/hd/do?_pageId=hdjjc05A"

        post_data = {
            'empNo_v1': user.userNo,
            'fromDate_v1': from_date,
            'fromTime_v1': from_time_input,
            'toDate_v1': to_date,
            'toTime_v1': to_time_input,
            'applyType_v1': 'A',
            'reasonDesc_v1': reason_desc,
            'ovHrs_v1': ovHrs,
            'reasonCode_v1': milestone,
            'status_v1': '00',
            'boss_v1': boss_v1,
            'compId_v1': user.login_info["icsc_sso"]["compNo"],
            'nowUser': user.userNo,
            '_action': 'N',
        }
        logger.debug(f"posting:{post_url}, data:{post_data}")
        resp = icsc_session.post(post_url, post_data)
        assert resp.status_code == 200, "查詢前筆預申請單失敗"

        soup = BeautifulSoup(resp.text, 'html.parser')
        msg = get_msg(soup)

        if "成功" in msg:
            element = soup.find('input', id='priKey_v1')
            assert element, "priKey_v1 not found"
            post_data['priKey_v1'] = element['value']
            post_data['_action'] = 'A'

            resp = icsc_session.post(post_url, post_data)
            assert resp.status_code == 200, "送出預申請單失敗"
            msg = get_msg(BeautifulSoup(resp.text, 'html.parser'))
            milestone_text = get_milestone_text(milestone).strip()
            apply_msg = f"*預申請加班: {from_date} {from_time_input}~{to_time_input} {reason_desc} {milestone_text}*" + "\n- " + msg
            return apply_msg
        else:
            return msg

    def get_examples(self) -> list:
        return [
            "預計5點到6點加班1小時，準備系統整體測試工作",
            "為了中保切換上線保駕，下週六下午1點到5點預計加班3小時"
        ]
