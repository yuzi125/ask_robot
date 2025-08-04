from datetime import datetime
from ava.utils.TimeSemanticExpressor import *


def test_chinese_weekday_to_numeric():
    print("昨天: ", chinese_weekday_to_numeric("昨天"))
    print("前天: ", chinese_weekday_to_numeric("前天"))
    print("大前天: ", chinese_weekday_to_numeric("大前天"))
    print("上上週五: ", chinese_weekday_to_numeric("上上週五"))
    print("上週五: ", chinese_weekday_to_numeric("上週五"))
    print("週五: ", chinese_weekday_to_numeric("週五"))
    print("下下週五: ", chinese_weekday_to_numeric("下下週五"))
    print("三個月後: ", chinese_weekday_to_numeric("三個月後"))
    print("兩個月前: ", chinese_weekday_to_numeric("兩個月前"))


def test_text_to_date():
    print("大大前天:", text_to_date("大大前天", ""))
    print("大前天:", text_to_date("大前天", ""))
    print("前天:", text_to_date("前天", ""))
    print("昨天:", text_to_date("昨天", ""))
    print("今天:", text_to_date("今天", ""))
    print("明天:", text_to_date("明天", ""))
    print("後天:", text_to_date("後天", ""))
    print("大後天:", text_to_date("大後天", ""))
    print("大大後天:", text_to_date("大大後天", ""))
    print("2024/06/27:", text_to_date("2024/06/27", ""))
    print("2024/6/27:", text_to_date("2024/6/27", ""))
    print("2024/6/7:", text_to_date("2024/6/7", ""))
    print("20240627:", text_to_date("20240627", ""))
    print("06/27:", text_to_date("06/27", ""))
    print("0627:", text_to_date("0627", ""))
    print("0627:", text_to_date("0627", ""))
    print("1130702:", text_to_date("1130702", ""))
    print("113.07.02:", text_to_date("113.07.02", ""))
    print("113/10/20:", text_to_date("113/10/20", ""))


print("---------------------")
print("today:", datetime.today().strftime("%Y-%m-%d"))
test_chinese_weekday_to_numeric()
print("---------------------")
print("today:", datetime.today().strftime("%Y-%m-%d"))
test_text_to_date()
