import requests, openai, re
from bs4 import BeautifulSoup
from ..utils import utils, env_utils
import logging

logger = logging.getLogger(__name__)

def execute_sql(sql):
    logger.info(f'sql: {sql}')
    if not sql.strip().lower().startswith('select '):
        raise ValueError(f'sql[{sql}] is prohibited to be executed.')

    url = env_utils.get_sql_page()
    cookies = utils.get_key("COOKIES")

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'keep-alive',
        'Cookie': cookies
    }

    post_data = {
        "Type": "1",
        "RowSize": "0",
        "SqlStr": sql
    }

    response = requests.post(url, data=post_data, headers=headers)
    if 'sso-logo.png' in response.text:
        raise ValueError('401')

    logger.info(response.text)
    soup = BeautifulSoup(response.text, 'html.parser')
    msg = soup.find('td', {'id': 'excepError'})
    if msg and msg.text:
        return msg.text

    element = soup.find('textarea', {'id': 'csvData'})
    return element.text.replace('"', "")


def handle_data_query(inquiry_str):
    logger.info("inquiry_str:" + inquiry_str)
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
        presence_penalty=0.0,
        stop=["#", ";"]
    )

    sql = response.choices[0].message.content.replace('LIMIT 1', 'fetch first row only')
    sql = re.sub(r'AS\s+\'[\w\s]+\'', '', sql)

    logger.info(f"sql composer response: {response}")

    return sql, execute_sql(sql)
