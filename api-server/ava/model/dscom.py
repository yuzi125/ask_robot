import json
from typing import Dict

import requests


class User:
    def __init__(self, json_obj: dict):
        self.name: str
        self.avatar: str | None
        self.sex: str
        self.user_type: str
        self.login_type: str
        self.is_enable: str
        self.login_info: dict[str, dict[str, str]]
        self.auth_id: dict[str, str]
        self.uid: str
        self.nickname: str
        self.user_no: str
        self.userNo: str
        self.cookies_pool : str = ""
        self.cookies:dict[str, str] = {}
        self.client_ip:str
        for k, v in json_obj.items():
            if isinstance(v, dict):
                for _key in v.keys():
                    try:
                        if isinstance(v[_key], str):
                            v[_key] = json.loads(v[_key])
                    except json.decoder.JSONDecodeError:
                        pass
            setattr(self, k, v)
        setattr(self, "userNo", getattr(self, "user_no"))


# "userInfo":{"uid":"152ad0a3-ccc6-4c87-bad8-27a274896c49",
# "nickname":"\xe9\x99\xb3\xe5\x93\x81\xe9\x83\x8e","avatar":null,"sex":"1","user_no":"I30412","user_type":2}}'

    @staticmethod
    def create_from_json(json_data):
        user = json.loads(json_data)["userInfo"]
        user["userNo"] = user["user_no"]
        return User(**user)

    def set_cookie(self, key, cookies: Dict):
        cookies_str = '; '.join(
            [f'{name}={value}' for name, value in cookies.items()])
        self.cookies_pool = cookies_str

    def get_cookie_str(self):
        return self.cookies_pool

    def get_cookie(self, key):
        cookies_dict = {}
        if len(self.cookies_pool) == 0:
            return cookies_dict
        for cookie_str in self.cookies_pool.split('; '):
            name, value = cookie_str.split('=', 1)
            cookies_dict[name] = value
        return cookies_dict

    def __str__(self):
        return (f"User("
                f"userNo: {self.userNo}, "
                f"sex: {self.sex},"
                f"cookies_pool: {self.cookies_pool})")
