from unittest import TestCase

from ava.utils.TimeSemanticExpressor import *


class Test(TestCase):
    def test_convert_leave_date_time(self):
        from_date, from_time, to_date, to_time = convert_leave_date_time(from_date="下週二", from_time="上午", to_date="下週二",
                                                                         to_time="")
        print(f"{from_date} {from_time} {to_date} {to_time}")

    def test_date_str(self):
        ans = chinese_weekday_to_numeric("12/12")
        print(ans)

    def test_text_to_date(self):
        ans = text_to_date("下週二", "今天")
        print(ans)
        ans = text_to_date("", "今天", "c")
        print(ans)
        ans = text_to_date("", "後天", "c")
        print(ans)
        ans = text_to_date("", "明天", "c")
        print(ans)
        ans = text_to_date("", "1130702", "c")
        print(ans)

    def test_text_to_time(self):
        ans = text_to_time(None, "08:00")
        print(ans)
        ans = text_to_time("三點半", "17:00")
        print(ans)
        ans = text_to_time("七點", "17:00")
        print(ans)
