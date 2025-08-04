from unittest import TestCase

from langchain_openai import ChatOpenAI, openai
from langchain_openai import OpenAIEmbeddings

from ava.handlers.ResourceBooker import ResourceBooker
from ava.utils import env_utils
from ava.utils.TimeSemanticExpressor import convert_date_time


class TestResourceBooker(TestCase):
    def test_handle(self):
        openai.api_key = env_utils.get_openai_key()
        llm = ChatOpenAI(
            model_name="gpt-3.5-turbo",
            temperature=0,
            max_tokens=1000,
            frequency_penalty=0,
            top_p=1.0,
        )
        # embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
        rb = ResourceBooker(llm)
        output = rb.parse_input("預約16:00 18樓會議室")
        data = output['booking_record'][0]
        from_time, to_time = convert_date_time(data['date'], data['booking_from'], data['booking_to'])
        print(f"from_time:{from_time}, to_time:{to_time}")
        print("-------------------")
        data = rb.parse_input("預約下午4點18樓會議室")
        from_time, to_time = convert_date_time(data['date'], data['booking_from'], data['booking_to'])
        print(f"from_time:{from_time}, to_time:{to_time}")
