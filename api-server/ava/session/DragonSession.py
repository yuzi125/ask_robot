import logging
from os import getenv
from typing import Any

import requests
from ava.model.dscom import User
from ava.utils import env_utils, utils
from ava.session.base import ISession
logger = logging.getLogger("ava_app")


class DragonERPSession(ISession):

    def __init__(self, user: User, httpclient: requests.Session, cookies=None):
        self.user = user
        self.httpclient = httpclient
        self.retry_guard = 0
        self.cookies = cookies if cookies else None

    def get_ds_ava_token(self, data: Any):
        """
        1. {
                id: '9fca15da-3407-40a0-bf9c-f3635d4e5087',
                name: 'AVA測試帳號',
                avatar: null,
                sex: '',
                user_type: 'member',
                login_type: 'dragon_steel_sso',
                is_enable: '1',
                login_info: {
                    dragon_steel_sso: {
                    redirect_url: 'http://10.101.35.166/ava/avaClient',
                    guid: 'AVAT01',
                    sid: 'DQUSrxOY87mttxEpnIqXEq6d',
                    auth_meta: '{"guid":"AVAT01","sid":"DQUSrxOY87mttxEpnIqXEq6d","toService":"avaPortal","gcid":"0016","cip":"10.0.118.53"}',
                    postNo: '34',
                    toService: 'avaPortal',
                    empNo: 'AVAT01',
                    cName: 'AVA測試帳號',
                    access_key: 'DQUSrxOY87mttxEpnIqXEq6d',
                    depNo: '',
                    gcid: '0016',
                    cip: '10.0.118.53'
                    }
                },
                auth_id: { dragon_steel_sso: 'AVAT01' },
                uid: '9fca15da-3407-40a0-bf9c-f3635d4e5087',
                nickname: 'AVA測試帳號',
                user_no: 'AVAT01'
            }
       
        2. 本地測試用
        # return {
        #     "auth_id": "031316",
        #     "auth_meta": {
        #         "guid": "031316",
        #         "sid": "D7j6NmmT9HJtBzRWji-aC8T7",
        #         "postNo": "34",
        #         "toService": "avaPortal",
        #         "empNo": "031316",
        #         "cName": "吳俊毅",
        #         "access_key": "D7j6NmmT9HJtBzRWji-aC8T7",
        #         "depNo": "F310",
        #         "gcid": "0016",
        #         "cip": "10.101.156.102",
        #         "auth_key": "DB87WMCn4zLPC8QK2czT_-GF"
        #     }
        # }
        """
        user = self.user
        dragon_erp_host: str | None = env_utils.get_key("DRAGON_ERP_HOST")
        if not dragon_erp_host:
            raise RuntimeError("DRAGON_ERP_HOST is not set")
        dragon_erp_host = dragon_erp_host.rstrip("/")
        avaTK_url: str = f"{dragon_erp_host}/erp/avaTK"
        post_body: dict[str, Any] = {
            "auth_id": user.auth_id.get("dragon_steel_sso"),
            "auth_meta": {
                "guid": user.login_info.get("dragon_steel_sso", {}).get("guid"),
                "sid": user.login_info.get("dragon_steel_sso", {}).get("sid"),
                "postNo": user.login_info.get("dragon_steel_sso", {}).get("postNo"),
                "toService": user.login_info.get("dragon_steel_sso", {}).get("toService"),
                "empNo": user.login_info.get("dragon_steel_sso", {}).get("empNo"),
                "cName": user.name,
                "access_key": user.login_info.get("dragon_steel_sso", {}).get("access_key"),
                "depNo": user.login_info.get("dragon_steel_sso", {}).get("depNo"),
                "gcid": user.login_info.get("dragon_steel_sso", {}).get("gcid"),
                "cip": user.client_ip
            }
        }
        resp = requests.post(avaTK_url, json=post_body)
        if resp.status_code != 200:
            logger.error("get_ds_ava_token error: {resp.status_code} {resp.text}")
            raise RuntimeError("ava token 獲取失敗")
        res_json = resp.json()
        logger.info(f"get_ds_ava_token res_json: {res_json}")
        post_body["auth_meta"]["auth_key"] = res_json.get("auth_meta",{}).get("auth_key")
        post_body["skill_meta"] = data
        return post_body

    def _do_action(self, url: str, data: Any, headers: dict, method: str):
        logger.debug(f"do_post url:{url} headers:{headers} data:{data}")

        if self.cookies:
            self.httpclient.cookies.update(self.cookies)

        action = self.httpclient.post
        match method:
            case "put":
                action = self.httpclient.put
            case "delete":
                action = self.httpclient.delete

        if headers.get('Content-Type') == 'application/json':
            return action(url, headers=headers,
                          json=data,
                          cookies=self.httpclient.cookies)
        else:
            return action(url,
                          headers=headers,
                          data=data,
                          cookies=self.httpclient.cookies)

    def get(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        self.get_ds_ava_token(data)
        logger.info(f"getting:{url}, {data}")
        return self._do_action(url, data, headers, "get")

    def post(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        post_data = self.get_ds_ava_token(data)
        logger.info(f"posting:{url}, {post_data}")
        return self._do_action(url, post_data, headers, "post")
    
    def put(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        post_data = self.get_ds_ava_token(data)
        logger.info(f"putting:{url}, {post_data}")
        return self._do_action(url, post_data, headers, "put")
    
    def delete(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        post_data = self.get_ds_ava_token(data)
        logger.info(f"deleting:{url}, {post_data}")
        return self._do_action(url, post_data, headers, "delete")

