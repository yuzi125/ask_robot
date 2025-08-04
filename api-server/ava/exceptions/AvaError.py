class AvaException(BaseException):
    """ Common base class for all non-exit exceptions. """

    def __init__(self, *args, **kwargs):  # real signature unknown
        pass

    @staticmethod  # known case of __new__
    def __new__(*args, **kwargs):  # real signature unknown
        """ Create and return a new object.  See help(type) for accurate signature. """
        pass


class InputError(AvaException):
    """ Inappropriate argument value (of correct type). """

    def __init__(self, *args, **kwargs):  # real signature unknown
        pass

    @staticmethod  # known case of __new__
    def __new__(*args, **kwargs):  # real signature unknown
        """ Create and return a new object.  See help(type) for accurate signature. """
        pass


class SemanticException(Exception):
    pass


class MyException(Exception):
    pass


class Authentication(Exception):
    pass
