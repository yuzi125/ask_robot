import logging.config
import os  # 導入os模塊讀取環境變量
import re
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin

import pytz
import yaml
from ava.utils import env_utils


# TimezoneAwareFormatter 不再接受 tzname 作為參數
class TimezoneAwareFormatter(logging.Formatter):

    def __init__(self, fmt=None, datefmt=None, style="%"):
        super().__init__(fmt=fmt, datefmt=datefmt, style=style)  #type: ignore
        # 從環境變量中讀取時區設定
        tzname = os.getenv("TZ", "UTC")  # 如果環境變量中沒有定義 TZ，則默認為 'UTC'
        self.tz = pytz.timezone(tzname)

    def formatTime(self, record, datefmt=None):
        ct = datetime.fromtimestamp(record.created, self.tz)
        if datefmt:
            s = ct.strftime(datefmt)
        else:
            try:
                s = ct.isoformat(timespec="milliseconds")
            except TypeError:
                s = ct.isoformat()
        return s


# setup_logging 方法現在不需要傳遞 tzname 參數
# def setup_logging(env):
#     print(env)
#     # 讀取 YAML 配置文件
#     with open(f'config/log_config.{env}.yaml', 'r', encoding='UTF-8') as f:
#         config = yaml.safe_load(f.read())
#         logging.config.dictConfig(config)

#     # 移除所有的既存 handler
#     for handler in logging.root.handlers[:]:
#         logging.root.removeHandler(handler)

#     # 建立 TimezoneAwareFormatter 實例
#     formatter = TimezoneAwareFormatter(
#         fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
#         datefmt='%Y-%m-%d %H:%M:%S,%f'
#     )

#     # 為每個 logger 新增 file handler
#     file_handler = logging.FileHandler('./log/ava_app.log', encoding='utf-8')
#     file_handler.setFormatter(formatter)
#     for logger_name in logging.root.manager.loggerDict:
#         logger = logging.getLogger(logger_name)
#         logger.addHandler(file_handler)  # 為每個現有的 logger 新增文件處理器
#         logger.propagate = False


def replace_env_variables(config):
    pattern = re.compile(r'\$\{([^}]+)\}')

    if isinstance(config, dict):
        return {k: replace_env_variables(v) for k, v in config.items()}
    elif isinstance(config, list):
        return [replace_env_variables(i) for i in config]
    elif isinstance(config, str):
        match = pattern.search(config)
        if match:
            env_var = match.group(1)
            return os.getenv(env_var, config)  # 用環境變數替換，若環境變數不存在則保持原值
        return config
    else:
        return config


def setup_logging(env):
    print(env)
    # 讀取 YAML 配置文件
    log_directory_path = "log"
    if not os.path.exists(log_directory_path):
        os.makedirs(log_directory_path)
    path = Path(
        __file__).parent.parent.parent / "config" / f"log_config.{env}.yaml"
    with open(path, "r", encoding="UTF-8") as f:
        config = yaml.safe_load(f.read())
        config = replace_env_variables(config)
        logging.config.dictConfig(config)


def parse_log_line(line):
    # 使用正則表達式來提取日期時間和日誌級別以及消息
    match = re.match(
        r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+) (\w+) (.+?) (\d+) -> (.*?) -> (.*?)\(line (\d+)\) -> (.*)",
        line,
        re.DOTALL,
    )
    level_to_color = {
        "DEBUG": "blue",  # 藍色代表 DEBUG 級別
        "INFO": "green",  # 綠色代表 INFO 級別
        "WARNING": "yellow",  # 黃色代表 WARNING 級別
        "ERROR": "red",  # 紅色代表 ERROR 級別
        "CRITICAL": "red",  # 紅色也代表 CRITICAL 級別
    }
    if match:
        color = level_to_color.get(match.group(2), "green")
        return {
            "timestamp": match.group(1),
            "module":
            f"{match.group(4)}  {match.group(5)} > {match.group(6)}(line {match.group(7)})",
            "level": match.group(2),
            "message": match.group(8),
            "color": color,
        }
    return None


def read_log_file(filename, specified_date, count, sort):
    parsed_logs = []
    current_log_entry = ""
    with open(filename, "r", encoding="utf-8") as file:
        for line in file:
            if re.match(
                    r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+) (\w+) (.+?) (\d+) -> (.*?) -> (.*?)\(line (\d+)\) -> (.*)",
                    line):
                if current_log_entry:  # 如果有正在處理的日誌條目，則先解析它
                    parsed_line = parse_log_line(current_log_entry)
                    if parsed_line and (not specified_date
                                        or parsed_line["timestamp"].startswith(
                                            specified_date)):
                        parsed_logs.append(parsed_line)
                current_log_entry = line
            else:
                current_log_entry += line  # 將當前行新增到正在處理的日誌條目
    # 處理最後一個日誌條目
    if current_log_entry:
        parsed_line = parse_log_line(current_log_entry)
        if parsed_line and (
                not specified_date
                or parsed_line["timestamp"].startswith(specified_date)):
            parsed_logs.append(parsed_line)

    parsed_logs.sort(key=lambda x: x["timestamp"],
                     reverse=(True if sort == "desc" else False))
    return parsed_logs[:count] if count > 0 else parsed_logs


def get_log_files_name(directory):
    # 確保提供的路徑是一個目錄
    filenames = []
    if os.path.isdir(directory):
        # 列出目錄中的所有檔案和子目錄名稱
        for filename in os.listdir(directory):
            # 構建完整的檔案路徑
            file_path = os.path.join(directory, filename)
            # 檢查是否為檔案
            if os.path.isfile(file_path):
                filenames.append(directory + "/" +
                                 filename if directory else filename)
        return filenames
