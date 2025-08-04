import datetime
import logging
import re
from datetime import datetime, timedelta

from ava.exceptions.AvaError import SemanticException
from dateutil.relativedelta import relativedelta

logger = logging.getLogger(__name__)

# 定義一個可擴展的時間單位字典
TIME_UNITS_MAP = {
    '天': 'days',
    '日': 'days',
    '週': 'weeks',
    '周': 'weeks',
    '禮拜': 'weeks',
    '月': 'months',
    '年': 'years'
}

# 定義數字對應
NUMBER_MAP = {
    '一': 1,
    '兩': 2,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
    '十': 10,
}


def parse_number(text):
    """解析中文或數字字符，返回整數"""
    if text.isdigit():
        return int(text)
    return NUMBER_MAP.get(text)


def parse_relative_date(input_str, base_date=None):
    if base_date is None:
        base_date = datetime.today()

    input_str = input_str.lower()

    # 特殊處理 '明天', '後天'
    if input_str == '明天':
        return base_date + relativedelta(days=1)
    elif input_str == '後天':
        return base_date + relativedelta(days=2)

    is_after = '後' in input_str
    is_before = '前' in input_str

    relative_part = input_str.replace('前', '').replace('後',
                                                       '').replace('個',
                                                                   '').strip()
    time_parts = re.split(r'又|和', relative_part)

    total_delta = relativedelta()

    for part in time_parts:
        number_match = re.search(r'([0-9一二三四五六七八九十兩]+)', part)
        unit_match = re.search(r'(天|日|週|周|禮拜|月|年)', part)

        if not number_match or not unit_match:
            continue

        number = parse_number(number_match.group(1))
        if number is None:
            continue

        time_unit = TIME_UNITS_MAP.get(unit_match.group(1))
        if time_unit is None:
            continue

        delta_args = {time_unit: number}
        total_delta += relativedelta(**delta_args)

    if is_before:
        return base_date - total_delta
    return base_date + total_delta


def chinese_time_to_formatted_number(chinese_time, delimiter=""):
    # AM/PM 格式
    am_pm_pattern = r'(\d{1,2}):?(\d{2})\s*(AM|PM)'
    match = re.match(am_pm_pattern, chinese_time, re.IGNORECASE)
    if match:
        hour, minute, am_pm = match.groups()
        hour = int(hour)
        if am_pm.lower() == 'pm' and hour < 12:
            hour += 12
        elif am_pm.lower() == 'am' and hour == 12:
            hour = 0
        formatted_hour = '{:02d}'.format(hour)
        return formatted_hour + delimiter + minute

    # 標準時間格式
    standard_time_pattern = r'\d{1,2}:\d{2}'
    if re.match(standard_time_pattern, chinese_time):
        hour, minute = chinese_time.split(':')
        formatted_hour = '{:02d}'.format(int(hour))
        return formatted_hour + delimiter + minute

    # 中文到數字的映射
    chinese_to_number = {
        '零': '0',
        '一': '1',
        '二': '2',
        '三': '3',
        '四': '4',
        '五': '5',
        '六': '6',
        '七': '7',
        '八': '8',
        '九': '9',
        '十': '10',
        '十一': '11',
        '十二': '12',
    }

    contains_half = '半' in chinese_time

    # 處理中文時間
    if '十' in chinese_time:
        chinese_time = chinese_time.replace('十一', '11').replace('十二',
                                                                '12').replace(
                                                                    '十', '10')

    for chinese_num, number in chinese_to_number.items():
        chinese_time = chinese_time.replace(chinese_num, number)

    is_pm = '下午' in chinese_time or '晚上' in chinese_time
    chinese_time = re.sub(r'(下午|上午|早上|今早|晚上)', '', chinese_time)
    chinese_time = chinese_time.replace('點', '')

    try:
        hour = int(chinese_time) if not contains_half else int(
            chinese_time.split('半')[0])
    except Exception:
        hour = 0

    if is_pm and hour < 12:
        hour += 12

    formatted_hour = '{:02d}'.format(hour)

    if contains_half:
        return formatted_hour + delimiter + '30'
    return formatted_hour + delimiter + '00'


def chinese_date_to_numeric(date_str):
    today = datetime.today()
    date_mapping = {
        "半月前": -15,
        "一月前": -30,
        "兩月前": -60,
        "三月前": -90,
        "大大前天": -4,
        "大大前日": -4,
        "大前天": -3,
        "大前日": -3,
        "前天": -2,
        "前日": -2,
        "昨天": -1,
        "昨日": -1,
        "今天": 0,
        "今日": 0,
        "明天": 1,
        "明日": 1,
        "後天": 2,
        "後日": 2,
        "大後天": 3,
        "大後日": 3,
        "大大後天": 4,
        "大大後日": 4,
        "半月後": 15,
        "一月後": 30,
        "兩月後": 60,
        "三月後": 90,
    }
    days_offset = date_mapping.get(date_str, None)
    if days_offset is not None:
        target_date = today + timedelta(days=days_offset)
        return target_date.strftime("%m%d")
    else:
        return None


# 將中文星期轉換為對應的數字
def get_week_day(input_string):
    exclude_pattern = r"[今明後昨前]"
    if re.findall(exclude_pattern, input_string):
        return -1

    keyword_pattern = r"[一二三四五六日天]"
    keywords = re.findall(keyword_pattern, input_string)
    if len(keywords) == 0:
        return -1
    weekday_mapping = [
        "一",
        "二",
        "三",
        "四",
        "五",
        "六",
        "日",
        "天",
    ]
    day = weekday_mapping.index(keywords[0])
    day = 6 if day > 6 else day
    return day


def process_week_period(str):
    return (str.count("下") + str.count("上") * -1) * 7


def chinese_weekday_to_numeric(date_str):
    today = datetime.today()
    if date_str in [None, "-", "", "X", "今天"]:
        return today.strftime("%m%d")

    parsed_date = parse_relative_date(date_str, today)
    return parsed_date.strftime("%m%d")


# for THSR Timetable 2023-07-22
def convert_date(date, delimiter="/"):
    if '/' in date:  # 6/3 => 06/03
        date_str = format_date(date, "")
    else:
        date_str = chinese_weekday_to_numeric(date)

    date_str = date_str[:2] + delimiter + date_str[2:]
    logger.info(f'date: {date}, date_str:{date_str}')
    yr = str(datetime.now().year)
    return yr + delimiter + date_str


# def is_today(date_str):


def convert_date_time(date, from_time, to_time):
    logger.info(f'convert_date_time:{date}, {from_time}, {to_time}')
    if '/' in date:  # 6/23
        date_str = format_date(date)
    else:
        date_str = chinese_weekday_to_numeric(date)
    logger.info(f'date: {date}, date_str:{date_str}')
    from_time_str = chinese_time_to_formatted_number(from_time)
    logger.info(from_time_str)
    # 如果沒有會議結束時間 就預設1個小時
    if to_time == "X" or to_time == "":
        logger.info(
            f'str(int(from_time_str)+100):{str(int(from_time_str) + 100)}')
        to_time_str = str(int(from_time_str) + 100)
    else:
        to_time_str = chinese_time_to_formatted_number(to_time)
    pattern = re.compile(r'^\d{4}$')
    from_ans = pattern.match(from_time_str)
    to_ans = pattern.match(to_time_str)
    date_ans = pattern.match(date_str)

    if from_ans and to_ans and date_ans:
        yr = datetime.now().year - 1911
        return f'{yr}{date_str}{from_time_str}', f'{yr}{date_str}{to_time_str}'
    else:
        raise ValueError(
            f"data format error: {from_time_str} or {to_time_str} ")


def format_date(date_string, delimeter=""):
    month, day = date_string.split('/')
    formatted_month = month.zfill(2)
    formatted_day = day.zfill(2)
    formatted_date = f"{formatted_month}{delimeter}{formatted_day}"
    return formatted_date


def text_to_date(date_str, default_value, yr_format="w"):
    if date_str is None or date_str.strip() == "":
        date_str = default_value

    if re.match(r"^\d{8}$", date_str):  # 20240701
        date_val = date_str[4:]
        yr = date_str[:4]
    elif re.match(r"^\d{7}$", date_str):  # 1130701
        yr = int(date_str[:3]) + 1911
        date_val = date_str[3:]
    elif re.match(r"^\d{4}/\d{2}/\d{2}$", date_str):  # 2024/07/01
        parts = date_str.split('/')
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
        yr = parts[0]
    elif re.match(r"^\d{4}/\d{1}/\d{2}$", date_str):  # 2024/7/1
        parts = date_str.split('/')
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
        yr = parts[0]
    elif re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):  # 2024-07-01
        parts = date_str.split('-')
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
        yr = parts[0]
    elif re.match(r"^\d{4}-\d{1}-\d{2}$", date_str):  # 2024-7-01
        parts = date_str.split('-')
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
        yr = parts[0]
    elif re.match(r"^\d{4}-\d{1}-\d{1}$", date_str):  # 2024-7-1
        parts = date_str.split('-')
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
        yr = parts[0]
    elif re.match(r"^\d{4}\.\d{2}\.\d{2}$", date_str):  # 2024.07.01
        parts = date_str.split('.')
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
        yr = parts[0]
    elif re.match(r"^\d{4}\.\d{1}\.\d{2}$", date_str):  # 2024.7.01
        parts = date_str.split('.')
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
        yr = parts[0]
    elif re.match(r"^\d{4}\.\d{1}\.\d{1}$", date_str):  # 2024.7.1
        parts = date_str.split('.')
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
        yr = parts[0]
    elif re.match(r"^\d{3}\.\d{2}\.\d{2}$", date_str):  # 113.07.01
        parts = date_str.split('.')
        yr = int(parts[0]) + 1911
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
    elif re.match(r"^\d{3}\.\d{1}\.\d{2}$", date_str):  # 113.7.01
        parts = date_str.split('.')
        yr = int(parts[0]) + 1911
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
    elif re.match(r"^\d{3}\.\d{1}\.\d{1}$", date_str):  # 113.7.1
        parts = date_str.split('.')
        yr = int(parts[0]) + 1911
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
    elif re.match(r"^\d{2}/\d{2}$", date_str):  # 07/01
        date_val = date_str.replace('/', '')
        yr = datetime.now().year
    elif re.match(r"^\d/\d{1,2}$", date_str):  # 7/1
        parts = date_str.split('/')
        date_val = f"{int(parts[0]):02d}{int(parts[1]):02d}"
        yr = datetime.now().year
    elif re.match(r"^\d{1,2}\.\d{1,2}$", date_str):  # 07.01 or 7.1
        parts = date_str.split('.')
        date_val = f"{int(parts[0]):02d}{int(parts[1]):02d}"
        yr = datetime.now().year
    elif re.match(r"^\d{4}$", date_str):  # 0701
        date_val = date_str
        yr = datetime.now().year
    elif re.match(r"^\d{3}/\d{1,2}/\d{1,2}$", date_str):  # 113/10/20
        parts = date_str.split('/')
        yr = int(parts[0]) + 1911
        date_val = f"{int(parts[1]):02d}{int(parts[2]):02d}"
    else:
        parsed_date = parse_relative_date(date_str)
        yr = parsed_date.year
        date_val = parsed_date.strftime("%m%d")

    yr_diff = -1911 if yr_format == "c" else 0
    yr = int(yr) + yr_diff
    logger.info(f'date_str:{date_str}, date_val:{date_val}')
    return f"{yr}{date_val}"


def text_to_time(time_str, default_value):
    if time_str is None or time_str.strip() == "":
        time_str = default_value
    return chinese_time_to_formatted_number(time_str)


def convert_leave_date_time(from_date, from_time, to_date, to_time):
    try:
        if from_date == '' and to_date == '':
            from_date = '今天'
            to_date = '今天'

        from_date_val = chinese_weekday_to_numeric(from_date)
        to_date_val = chinese_weekday_to_numeric(to_date)
        if from_date_val is None and '/' in from_date:  # 6/23
            from_date_val = format_date(from_date)
        if to_date_val is None and '/' in to_date:  # 6/23
            to_date_val = format_date(to_date)
        if from_time == '' and to_time == '':
            from_time = '8點半'
            to_time = '5點半'

        # TODO 個人化定制: 上午是幾點到幾點，下午是指幾點到幾點
        from_time_val = chinese_time_to_formatted_number(from_time)
        to_time_val = chinese_time_to_formatted_number(to_time)

        yr = datetime.now().year - 1911
    except ValueError as ve:
        raise SemanticException(
            f"時間有誤 [{from_date} {from_time} ~ {to_date} {to_time}]. 範例:下週二 8點半~9點 "
        )

    return f'{yr}{from_date_val}', from_time_val, f'{yr}{to_date_val}', to_time_val


def date_to_short_format(date_string):
    name = ['一', '二', '三', '四', '五', '六', '日']
    date = datetime.strptime(date_string, '%Y%m%d')
    weekday = date.weekday()
    return str(date.month) + "/" + str(date.day) + "(" + name[weekday] + ")"


def date_to_weekday(date_string):
    name = ['一', '二', '三', '四', '五', '六', '日']
    date = datetime.strptime(date_string, '%Y-%m-%d')
    weekday = date.weekday()
    return name[weekday]


def compute_elasped_time(start_time_str, end_time_str):
    time_format = "%H:%M"
    start_time = datetime.strptime(start_time_str, time_format)
    end_time = datetime.strptime(end_time_str, time_format)
    elapsed_time = str(end_time - start_time)
    elapsed_time = re.sub(":00$", "分", elapsed_time)
    elapsed_time = re.sub(":", "時", elapsed_time)
    return elapsed_time


# str = convert_date("今天",""),
# logger.info( str )

# print(date_to_short_format("20230724"))


def is_future(target_date_str):
    target_date = datetime.strptime(target_date_str, "%Y%m%d").date()
    today = datetime.today().date()
    return target_date > today


def adjust_from_to(from_time, to_time):
    # Convert the time strings to datetime objects
    time_start = datetime.strptime(from_time, "%H%M")
    time_end = datetime.strptime(to_time, "%H%M")

    # Calculate the difference, accounting for the day transition
    if time_end < time_start:
        time_end += timedelta(days=1)

    duration = time_end - time_start
    duration -= timedelta(hours=12)
    if duration > timedelta(seconds=0):
        time_end += timedelta(hours=12)
    return time_start.strftime("%H%M"), time_end.strftime("%H%M")


def get_year_ago(year_diff):
    # Current date
    current_date = datetime.now()

    # Calculate the date one year ago
    # Using replace() to ensure leap years are accounted for
    year_ago = current_date.replace(year=current_date.year - year_diff)

    return year_ago.year


# 10年來
def get_date_period(year_diff):
    # Current date
    current_date = datetime.now()

    end_date = datetime(current_date.year - 1, 12, 31)
    start_date = datetime(current_date.year - year_diff, 1, 1)
    start_date_str = start_date.strftime("%Y/%m/%d")
    end_date_str = end_date.strftime("%Y/%m/%d")
    return start_date_str, end_date_str


# print(chinese_weekday_to_numeric(date_str))
# from_time, to_time = adjust_from_to("0701", "0700")
# logger.info(from_time, to_time)

# print(chinese_time_to_formatted_number("7點半"))

