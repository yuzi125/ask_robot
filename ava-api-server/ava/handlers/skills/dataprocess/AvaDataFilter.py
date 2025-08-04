from abc import ABC, abstractmethod

from ava.handlers.skills.CommonConfig import Schema


class AvaDataFilter(ABC):
    def __str__(self):
        return self.__class__.__name__

    @abstractmethod
    def before_post(self, input_data, schema: Schema):
        pass

    @abstractmethod
    def after_post(self, input_data, schema: Schema, resp):
        pass

    @abstractmethod
    def before_get(self, input_data, schema: Schema):
        pass

    @abstractmethod
    def after_get(self, input_data, schema: Schema, resp):
        pass

    @abstractmethod
    def before_put(self, input_data, schema: Schema):
        pass

    @abstractmethod
    def after_put(self, input_data, schema: Schema, resp):
        pass

    @abstractmethod
    def before_delete(self, input_data, schema: Schema):
        pass

    @abstractmethod
    def after_delete(self, input_data, schema: Schema, resp):
        pass
