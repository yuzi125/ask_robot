import httpx
import requests
from typing import Any, Optional
from langchain_openai import ChatOpenAI

from ava.handlers.AvaHandler import AvaHandler
from ava.handlers.skills.SkillConfigLoader import load_skill_config_from_db
from ava.handlers.skills.WebAPIConfig import WebAPIConfig
from ava.handlers.skills.CommonActions import run_actions
from ava.model.dscom import User
from ava.clients.sql.schema import Expert_Schema
from ava.clients.sql.crud import select_expert_from_id
from ava.session.CSCsession import CSCSession
from ava.utils.CustomKor import generate_prompt, process_result
from ava.utils.GPTHandler import GPTHandler
from ava.utils.model_utils import get_model_and_params
from ava.utils import env_utils
from ava.utils.return_message_style import error_msg
from ava.utils.TimeSemanticExpressor import *
from ava.utils.web_utils import *



class JustSkillTest(AvaHandler):

    def __init__(self, llm, skill_id, skill_name):
        super().__init__(llm, skill_id, skill_name)
        self.skill_id = skill_id
        self.skill_name = skill_name
        self.config: WebAPIConfig | None = None

    def get_host_url(self):
        return "http://127.0.0.1:25000"

    def get_intention(self):
        assert self.config, "config is None"
        return self.config.intention

    def get_system_prompt(self):
        assert self.config, "config is None"
        return self.config.system_prompt

    def construct_instructions(self, messages: list):
        messages.clear()

    def is_streaming(self):
        return True

    def get_examples(self) -> list:
        assert self.config, "config is None"
        return self.config.get_examples()
    
    def load_skill(self):
        assert self.session_maker, "session_maker is not set"
        with self.session_maker() as _session:
            logger.info(f"load_skill_from_db from skill_id: {self.skill_id}")
            config_json = load_skill_config_from_db("", self.skill_id, _session)
        logger.info(f"load_skill_from_db from config_json: {config_json}")
        config = WebAPIConfig.from_json_string(config_json)
        logger.info(f"load_skill_from_db from config: {config}")
        self.config = config

    def get_data_schema(self, query):
        self.load_skill()
        assert self.config, "config is None"
        if self.config.schema:
            return self.config.schema.get_kor_definition()
        else:
            return None
        
    def message(self,message:str):
        assert self.config, "config is None"
        return "..."+ message + "..."
    
    # paste from CSCWebAPI
    def run_actions(self, user:User, schema_input: dict[str,Any] | list[dict[str,Any]], cookies=None)-> list[Any]:
        assert self.config, "config is None"
        input_data: dict[str,Any]
        if isinstance(schema_input,list):
            if len(schema_input)==0:
                input_data = {}
            else:
                input_data = schema_input[0]
        elif isinstance(schema_input,dict):
            input_data = schema_input

        input_data["_user"] = user
        input_data["_client_ip"] = user.client_ip
        input_data["_host"] = self.get_host_url()
        input_data["ava_token"] = "skill_test_token"
        csc_session: CSCSession = CSCSession(user, requests.Session(), cookies)
        actions_responses = run_actions(csc_session, input_data, self.config)
        resp_text = []
        for action_response in actions_responses:
            if action_response["type"] == "message":
                resp_text.append({"type": "data"})
                resp_text.append(action_response["content"])
            elif action_response["type"] == "card":
                resp_text.append({"type": "card"})
            elif action_response["type"] == "api_response":
                resp_text.append(action_response["content"]["message"])
                pass
            elif action_response["type"] == "html_json":
                resp_text.append({"type": "html_json"})
                resp_text.append(action_response["content"])
            elif action_response["type"] == "error":
                resp_text.append({"type": "data"})
                resp_text.append(error_msg(action_response["content"]))
        return resp_text

    def post(self, chat_uuid, expert_data, user: User, schema_input_data, query,cookies=None):
        return self.run_actions(user, schema_input_data, cookies)

    # paste from CSCWebAPI
    def handle(self, chat_uuid, expert_id, user: User, query, chat_context: list, cookies=None):
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
                row_expert: Optional[Expert_Schema] = select_expert_from_id(expert_id=expert_id,session=session)
                assert row_expert
                model_params = {
                    "top_p": 0,
                    "max_tokens": 2000,
                    "temperature": 0.1,
                    "frequency_penalty": 0
                }
                model_dict: dict[str, Any] = get_model_and_params(expert_config_json=row_expert.config_jsonb,session=session)
                model: str = model_dict["kor"]["model"]
                model_params.update(model_dict["kor"]["params"])
                llm_params_key :list[str] = ["max_tokens","temperature","frequency_penalty","top_p"]
                redundent_key :list[str] = []
                for key in model_params.keys():
                    if key not in llm_params_key:
                        redundent_key.append(key)
                for k in redundent_key:
                    del model_params[k]

                self.llm = ChatOpenAI(model=model, temperature=0, max_tokens=2000)
                prompt: str = generate_prompt(
                    user_input=query,
                    schema_id=schema["id"],
                    schema_description=schema["description"],
                    parameter=schema["parameters"],
                    example=schema["examples"])   
                gpt = GPTHandler(api_key=env_utils.get_openai_key())
                llm_response = gpt.run_gptModel(
                            session=session, 
                            user=user,
                            messages=[{"role": "user", "content": prompt}],
                            user_input=query,
                            model_list_id = model_dict["kor"]["model_list_id"],
                            expert_data=expert_data,
                            chat_uuid=chat_uuid,
                            classify="intent",
                            model=model,
                            params=model_params)
    
                logger.info(f"JustSkillTest Kor llm_response: {llm_response}")
                data: list[dict[str,str]] = process_result(llm_response, schema["id"]) 
                logger.info(f"JustSkillTest Kor llm_response after process: {data}")
                handle_data = data
                if len(handle_data) == 0:
                    logger.error(
                        f"Input:{query} , schema.id[{schema["id"]}] has no data with `{schema}`"
                    )
        else:
            handle_data= []
        return self.post(chat_uuid, expert_data, user, handle_data, query, cookies)
    
   

