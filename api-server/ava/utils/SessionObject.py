class MySession:
    context = None  # Class variable
    category = -1

    @classmethod
    def save_context(cls, context):
        MySession.context = context

    @classmethod
    def append_context(cls, context):
        if MySession.context is not None:
            MySession.context = MySession.context + "\nQuery Result:\n" + context
        else:
            MySession.save_context(context)

    @classmethod
    def get_context(cls):
        return MySession.context

    @classmethod
    def save_category(cls, category):
        MySession.category = category

    @classmethod
    def get_category(cls):
        return MySession.category
