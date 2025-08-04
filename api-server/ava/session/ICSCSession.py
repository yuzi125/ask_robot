import logging

import requests
from ava.model.dscom import User
from ava.session.base import ISession
from ava.utils import utils
from typing import Any
logger = logging.getLogger("ava_app")


class ICSCSession(ISession):

    def __init__(self, user: User, httpclient: requests.Session):
        self.user = user
        self.httpclient = httpclient
        self.retry_guard = 0
        self.cookies = None

    def _load_cookie(self):
        self.cookies = self.user.get_cookie("icsc")
        if self.cookies:
            self.httpclient.cookies.update(self.cookies)
            return True
        else:
            return False

    def _do_action(self, url: str, data: Any, headers: dict, method: str) -> requests.Response:
        if not self._load_cookie():
            utils.decorate_header(self.user, headers)

        action = self.httpclient.post
        match method:
            case "get":
                action = self.httpclient.get
            case "put":
                action = self.httpclient.put
            case "delete":
                action = self.httpclient.delete    

        if method == "get":
            resp = action(url, headers=headers, params=data)
        elif headers.get('Content-Type') == 'application/json':
            resp = action(url, headers=headers, json=data)
        else:
            resp = action(url, headers=headers, data=data)

        if ICSCSession.is_timeout(resp):
            raise ValueError("fail to login icsc")
        return resp
    
    def get(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        return self._do_action(url, data, headers, "get")

    def post(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        return self._do_action(url, data, headers, "post")
    
    def put(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        return self._do_action(url, data, headers, "put")
    
    def delete(self, url: str, data: Any, headers: dict, _: dict = None) -> requests.Response:
        return self._do_action(url, data, headers, "delete")

    @staticmethod
    def is_timeout(response):
        return 'sso-logo.png' in response.text
