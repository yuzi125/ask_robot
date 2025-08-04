import requests
import logging

from os import getenv
from ava.model.dscom import User
from ava.utils import env_utils, utils
from ava.session.base import ISession
from typing import Any
logger = logging.getLogger("ava_app")


class CSCSession(ISession):
    url = env_utils.get_aord_sso()

    def __init__(self, user: User, httpclient: requests.Session, cookies=None):
        self.user = user
        self.httpclient = httpclient
        self.retry_guard = 0
        self.cookies = cookies if cookies else None

    def relogin(self) -> None:
        dsaord_url = env_utils.get_aord_sso()
        self.httpclient.cookies.clear()
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Connection': 'keep-alive'
        }
        logger.debug(f"relogin: {dsaord_url} ")
        self.httpclient.get(dsaord_url,
                            headers=utils.decorate_header(self.user, headers))

    def _load_cookie(self) -> bool:
        if self.cookies:
            self.httpclient.cookies.update(self.cookies)
            return True
        else:
            csc_cookie = self.user.get_cookie("csc")
            if csc_cookie:
                self.httpclient.cookies.update(csc_cookie)
                return True
        return False

    def _do_action(self, url: str, data: Any, headers: dict, method: str) -> requests.Response:
        headers["X-EZOAG-TOKEN"] = getenv("X-EZOAG-TOKEN")
        headers["X-EZOAG-JWT"] = getenv("X-EZOAG-JWT")
        logger.debug(
            f"method:{method} url:{url} headers:{headers} data:{data}")

        if self.cookies:
            self.httpclient.cookies.update(self.cookies)

        action = self.httpclient.post
        match method:
            case "get":
                action = self.httpclient.get
            case "put":
                action = self.httpclient.put
            case "delete":
                action = self.httpclient.delete

        if method == "get":
            resp = action(url, headers=headers, params=data, cookies=self.httpclient.cookies)
        elif headers.get('Content-Type') == 'application/json':
            resp =  action(url, headers=headers, json=data, cookies=self.httpclient.cookies)
        else:
            resp = action(url, headers=headers, data=data, cookies=self.httpclient.cookies)

        if CSCSession.is_timeout(resp):
            raise ValueError("fail to login csc")
        return resp

    def get(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        logger.info(f"getting:{url}, {data}")
        return self._do_action(url, data, headers, "get")
        
    def post(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        logger.info(f"posting:{url}, {data}")
        return self._do_action(url, data, headers, "post")
  
    def put(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        logger.info(f"putting:{url}, {data}")
        return self._do_action(url, data, headers, "put")

    def delete(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        logger.info(f"deleting:{url}, {data}")
        return self._do_action(url, data, headers, "delete")
 
    @staticmethod
    def is_timeout(response):
        return ' name="uxPassword" ' in response.text
