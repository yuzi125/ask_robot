import logging
from abc import abstractmethod
from typing import Any

from ava.clients.sql.crud import select_expert_from_id
from ava.clients.sql.schema import Expert_Schema
from ava.handlers.AvaHandler import AvaHandler
from ava.model.dscom import User
from ava.utils import env_utils
from ava.utils.AzureOpenAIHandler import run_azure_openai_model
from ava.utils.ClaudeHandler import ClaudeHandler
from ava.utils.CustomKor import generate_prompt, process_result
from ava.utils.GPTHandler import GPTHandler
from ava.utils.model_utils import get_model_and_params
from ava.utils.TwccFFmHandler import run_ffm_langchain, run_ffm_model
from ava.utils.GeminiHandler import GeminiHandler
from langchain_openai import ChatOpenAI

inquiry_template = """
    User Query: {query}

    Relevant Context: {result}
"""

logger = logging.getLogger("ava_app")

csc_api_host = env_utils.get_key("CSC_API_HOST")
csc_host = env_utils.get_key("CSC_HOST")


class CSCWebAPI(AvaHandler):

    def get_host_url(self):
        return csc_api_host

    def get_csc_host_url(self):
        return csc_host

    def handle(self, chat_uuid, expert_id, user: User, query,
               chat_context: list, cookies=None):
        self.auth_user_login_type(user)
        handle_data = {}
        expert_data = {
            "expert_id": expert_id,
            "expert_model": self.__class__.__name__,
            "expert_model_type": "2",
        }
        schema: dict = self.get_data_schema(query)
        if schema:
            assert self.session_maker, "session_maker is not set"
            with self.session_maker() as session:
                row_expert: Expert_Schema | None = select_expert_from_id(
                    expert_id=expert_id,session=session)
                assert row_expert
                model_params = {
                    "top_p": 0,
                    "max_tokens": 2000,
                    "temperature": 0.1,
                    "frequency_penalty": 0
                }
                model_dict: dict[str, Any] = get_model_and_params(
                    expert_config_json=row_expert.config_jsonb,session=session)
                vendor : str = model_dict["kor"]["vendor"]
                model: str = model_dict["kor"]["model"]
                model_params.update(model_dict["kor"]["params"])
                llm_params_key :list[str] = ["max_tokens","temperature","frequency_penalty","top_p"]
                redundent_key :list[str] = []
                for key in model_params.keys():
                    if key not in llm_params_key:
                        redundent_key.append(key)
                for k in redundent_key:
                    del model_params[k]
                prompt: str = generate_prompt(
                    user_input=query,
                    schema_id=schema["id"],
                    schema_description=schema["description"],
                    parameter=schema["parameters"],
                    example=schema["examples"])

                if vendor == "azure" or vendor == "caf-azure":
                    llm_response = run_azure_openai_model(
                        session=session,
                        model_list_id=model_dict["kor"]["model_list_id"],
                        chat_uuid=chat_uuid,
                        user=user,
                        expert_data=expert_data,
                        model_key=model,
                        user_input=query,
                        model_params=model_params,
                        user_prompts=[prompt])
                elif vendor == "twcc":
                    llm_response = run_ffm_model(session=session,
                                                chat_uuid=chat_uuid,
                                                model_list_id = model_dict["kor"]["model_list_id"],
                                                user=user,
                                                expert_data=expert_data,
                                                model_key=model,
                                                user_input=query,
                                                model_params=model_params,
                                                user_prompts=[prompt])
                elif vendor == "openai":
                    self.llm = ChatOpenAI(model=model,
                                        temperature=0,
                                        max_tokens=2000) #type: ignore
                    gpt = GPTHandler(api_key=env_utils.get_openai_key())
                    llm_response = gpt.run_gptModel(session=session,
                                                    user=user,
                                                    messages=[{
                                                        "role": "user",
                                                        "content": prompt
                                                    }],
                                                    user_input=query,
                                                    model_list_id = model_dict["kor"]["model_list_id"],
                                                    expert_data=expert_data,
                                                    chat_uuid=chat_uuid,
                                                    classify="intent",
                                                    model=model,
                                                    params=model_params)
                elif vendor == "anthropic":
                    claude = ClaudeHandler()
                    llm_response = claude.run_model_not_stream(
                        session=session,
                        user=user,
                        user_input=query,
                        expert_data=expert_data,
                        chat_uuid=chat_uuid,
                        model_list_id = model_dict["kor"]["model_list_id"],
                        system_prompt="",
                        message_content=prompt,
                        model_params=model_params,
                        model=model)
                elif vendor == "local":
                    row_expert: Expert_Schema | None = select_expert_from_id(expert_id=expert_data["expert_id"],session=session)
                    assert row_expert
                    base_url = row_expert.config_jsonb["search"][row_expert.config_jsonb["search"]["current_config"]].get("base_url")
                    assert base_url, "local model base_url is not set"
                    local_model_handler = GPTHandler(api_key ="LOCAL",base_url=base_url)
                    llm_response = local_model_handler.run_gptModel(session=session,
                                                user=user,
                                                messages=[{
                                                    "role": "user",
                                                    "content": prompt
                                                }],
                                                user_input=query,
                                                model_list_id = model_dict["kor"]["model_list_id"],
                                                expert_data=expert_data,
                                                chat_uuid=chat_uuid,
                                                classify="intent",
                                                model=model,
                                                params=model_params)
                elif vendor == "google":
                    google_api_key = env_utils.get_google_api_key()
                    if google_api_key is None:
                        raise RuntimeError("缺少 Gemini 相關環境變數")
                    handler = GeminiHandler(api_key=google_api_key)
                    llm_response = handler.run_gemini_model_not_stream(
                        session=session,
                        chat_uuid=chat_uuid,
                        user=user,
                        user_input=query,
                        expert_data=expert_data,
                        system_prompt="",
                        message_content=prompt,
                        model_params=model_params,
                        model_list_id=model_dict["kor"]["model_list_id"],
                        model=model
                    )
                else:
                    raise RuntimeError(f"未支援的模型 {model}")
                logger.info(f"CSCWebAPI Kor llm_response: {llm_response}")
                data: list[dict[str,
                                str]] = process_result(llm_response, schema["id"]) #type: ignore
                # data = GPTHandler.run_gptModel_langChain(
                #     chat_uuid, user, self.llm, expert_data, schema, query)
                logger.info(f"CSCWebAPI Kor llm_response after process: {data}")
                handle_data = data
                # handle_data = data[schema.id]
                if len(handle_data) == 0:
                    logger.error(
                        f"Input:{query} , schema.id[{schema["id"]}] has no data with `{schema}`"
                    )
        else:
            # 這是為了處理沒有schema的情況 硬給他一個 key
            handle_data= []
        return self.post(chat_uuid, expert_data, user, handle_data, query, cookies)

    def direct_handle_with_data(self, user: User,
                                post_params: dict[str, Any],cookies: dict[str, Any] | None = None) -> Any:
        return self.post(**post_params, user=user,cookies=cookies)

    def is_streaming(self):
        return False

    def return_directly(self):
        return True

    @abstractmethod
    def get_data_schema(self, query) -> dict:
        pass

    @abstractmethod
    def post(self, chat_uuid, expert_data, user, handle_data, query, cookies=None):
        pass
