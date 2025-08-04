from abc import ABC, abstractmethod
from typing import Any
import requests

class ISession(ABC):

    @abstractmethod
    def get(self, url: str, data: Any, headers: dict, cookies: dict) -> requests.Response:
        pass

    @abstractmethod
    def post(self, url: str, data: Any, headers: dict, cookies: dict) -> requests.Response:
        pass

    @abstractmethod
    def put(self, url: str, data: Any, headers: dict, cookies: dict) -> requests.Response:
        pass

    @abstractmethod
    def delete(self, url: str, data: Any, headers: dict, cookies: dict) -> requests.Response:
        pass
