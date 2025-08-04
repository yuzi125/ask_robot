import logging

import re
import requests
from bs4 import BeautifulSoup
from langchain_openai import ChatOpenAI

from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.utils.SessionObject import MySession
from ava.utils import env_utils, utils

query_db_template = """

    User Query: {query}

    Query result: {result}

"""

logger = logging.getLogger(__name__)


def execute_sql(user: User, sql):
    logger.info(f'sql: {sql}')
    if not sql.strip().lower().startswith('select '):
        raise ValueError(f'sql[{sql}] is prohibited to be executed.')

    url = env_utils.get_sql_page()
    cookies = env_utils.get_prod_cookies()

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'keep-alive'
    }

    post_data = {
        "Type": "1",
        "RowSize": "0",
        "SqlStr": sql
    }

    response = requests.post(url, data=post_data, headers=utils.decorate_header(user, headers))
    if 'sso-logo.png' in response.text:
        raise ValueError('401')

    # print(response.text)
    soup = BeautifulSoup(response.text, 'html.parser')
    msg = soup.find('td', {'id': 'excepError'})
    if msg and msg.text:
        return msg.text

    element = soup.find('textarea', {'id': 'csvData'})
    return element.text.replace('"', "")


def handle_data_query(user: User, inquiry_str):
    logger.info("inquiry_str:" + inquiry_str)
    raise NotImplementedError("Sorry, this function not supported at this moment.")

    response = openai.Completion.create(
        model="text-davinci-003",
        prompt=f"""
        ### DB2 SQL tables, with their String properties: 
        #   
        #   table    :  db.tbdu01 ( 使用者基本資料檔 )
        #   --- 
        #   compNo		公司別		
        #   userNo		使用者代號	
        #   sex			性別  [1-男,0-女,X-其他]
        #   postNo		職稱代碼 String [30-專案經理,31-工程師,32-管理師,21-經理,11-協理]
        #   depNo		單位代碼	(編碼規則 S 加 2 位數字，ex: S00, S10, S21, S41 )
        #   cname		中文姓名		
        #   birthday	出生日期		
        #   phone1		聯絡電話		
        #   email		電子郵件		
        #   address		通訊地址		
        #   validDate	使用期限	( < '20230712'-已離職, > '20230712'-在職 )	
        #   remitAcct1	匯款帳號	 
        #   payType		放款方式    [B-匯款,C-支票,F-現金,X-其他]
        #
        ### 注意: 所有查詢皆加上條件 " 使用期限 > '20230712'" , 統計'各小組分別' 的意思是指以 '單位來做群組', S部門是指 depNo like 'S%', E部門是指 depNo like 'E%', K部門是指 depNo like 'K%', S2 是指 depNo like 'S2%', S1 是指 depNo like 'S1%', S4 是指 depNo like 'S4%'      
        ### {inquiry_str} ;
        """,
        temperature=0,
        max_tokens=150,
        top_p=1.0,
        frequency_penalty=0.0,
        stop=["#", ";"]
    )

    sql = response['choices'][0]['text'].replace('LIMIT 1', 'fetch first row only')
    sql = re.sub(r'AS\s+\'[\w\s]+\'', '', sql)

    logger.info(f"sql composer response: {response}")

    return sql, execute_sql(user, sql)


class DataInquirer(AvaHandler):

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list):
        self.auth_user_login_type(user)
        logger.info("Using SQL handler...")
        sql, result = handle_data_query(user, query)
        chat_context.append(query)
        chat_context.append(" " + result)
        logger.info(sql)
        logger.info(result)
        query_with_context = query_db_template.format(query=query,
                                                      result=result.replace(
                                                          "\n", "<br>"))
        logger.info("query_with_context:\n" + query_with_context)
        return query_with_context

    def keep_context(self):
        return True

    def get_system_prompt(self):
        return """
As a dedicated Database Administrator (DBA) responsible for managing company personnel and department-specific databases,
you will receive user inquiries related to the company's organizational structure.
If the assistant content contains a mix of alphanumeric characters, it represents the unit code of the company's organization.
If the assistant content consists solely of numbers, it represents the number of people. Please reply following this principle.
Response only in clean tabular format, do not include any other title or descriptions in the output.
Make sure to provide all the query results when responding, without missing any fields.

please output in markdown format, such as follows:
 
| Column 1 Header | Column 2 Header | Column 3 Header |
|-----------------|-----------------|-----------------|
| Row 1, Col 1    | Row 1, Col 2    | Row 1, Col 3    |
"""

    def is_streaming(self):
        return True

    def get_examples(self) -> list:
        return [
            "S部門各單位分別有多少人",
            "S部門女生最多是哪個單位",
            "S部門有幾位經理",
        ]

    def get_intention(self):
        intention = "Inquire about the number of employees, gender distribution in the company, manager distribution data, etc."
        return intention

    def get_intention_type(self):
        return "Q"
