import zoneinfo
from collections import defaultdict
from datetime import datetime, timedelta, timezone


class TrieNode:

    def __init__(self):
        self.children = defaultdict(TrieNode)
        self.replacement = None


class Trie:

    def __init__(self):
        self.root = TrieNode()

    def insert(self, word, replacement):
        node = self.root
        for char in word:
            node = node.children[char]
        node.replacement = replacement

    def search(self, text):
        node = self.root
        last_replacement = None
        last_index = -1

        for i, char in enumerate(text):
            if char in node.children:
                node = node.children[char]
                if node.replacement is not None:
                    last_replacement = node.replacement
                    last_index = i
            else:
                break

        return last_replacement, last_index


class DateReplacer:
    _trie = None

    _last_build_date = None

    @classmethod
    def _build_trie(cls) -> None:
        taipei_timezone = zoneinfo.ZoneInfo("Asia/Taipei")
        today = datetime.now(tz=taipei_timezone).date()

        # 如果日期變了，就重建 Trie
        if cls._trie is None or cls._last_build_date != today:
            cls._trie = Trie()
            cls._last_build_date = today
            date_mapping = {
                "去年今天": -365,
                "前年": -730,
                "去年": -365,
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
                "今年": 0,
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
                "明年": 365,
                "明年今天": 365,
                "後年": 730
            }

            for key, offset in date_mapping.items():
                if key == "今年":
                    target_date = today.strftime("%Y")
                else:
                    target_date = (datetime.combine(
                        today, datetime.min.time(), tzinfo=taipei_timezone) +
                                   timedelta(days=offset)).strftime("%Y/%m/%d")
                cls._trie.insert(key, target_date)

    @classmethod
    def replace_dates(cls, text) -> str:
        cls._build_trie()
        assert cls._trie is not None, "Trie is not built"
        i = 0
        result = []
        while i < len(text):
            replacement, end_index = cls._trie.search(text[i:])
            if replacement is not None:
                result.append(replacement)
                i += end_index + 1
            else:
                result.append(text[i])
                i += 1
        return ''.join(result)
