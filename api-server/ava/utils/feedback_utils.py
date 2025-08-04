import logging
import tiktoken
import json
import ast
from typing import Tuple

from retrying import retry
from ava.clients.sql.database import create_db_engine, create_session_maker, session_scope
from ava.model.dscom import User
from ava.prompts.feedback_classifier import feedback_classify_prompt
from ava.utils import env_utils
from ava.utils.GPTHandler import GPTHandler


logger: logging.Logger = logging.getLogger("ava_app")

_max_output_token_length = 16000
_GPT_model_name = "gpt-4o"

def _str_to_dict(s: any) -> dict[str,list[str]]:
    if not isinstance(s,str):
        return {}
    
    dict = {}
    for item in s.split("\n"):
        try:
            logger.debug(f"feedback_classifier item: {item}")
            questionID, keys = item.split(":")
            questionID = questionID.replace("\n", "").replace("\t", "").replace(" ", "")
            keys = keys.replace("\n", "").replace("\t", "").replace(" ", "").rstrip(",")

            key_list = ast.literal_eval(keys)
            if not isinstance(key_list, list):
                continue
            for key in key_list:
                if not(key in dict and isinstance(dict[key], list)):
                    dict[key] = []
                dict[key].append(questionID)
        except Exception as e:
            logger.error(f"feedback_classifier error: {e}")
            pass
    return dict

def  _dict_to_str(content:dict[int, list[str]]) -> str:
    s = "".join([f"\n\t{k}:{v.replace("\n", "").replace("\t", "").replace(" ", "")}" for k, v in content.items()])
    return f"{{{s}\n}}"

@retry( 
    stop_max_attempt_number=1,
    wait_exponential_multiplier=1000,
    wait_exponential_max=2000,
)
def feedback_classifier(user: User, feedbacks:dict[str, str], session) -> Tuple[dict[int, list[str]], list[str] ,int, int, int]:  
    prompt = feedback_classify_prompt(_dict_to_str(feedbacks))
    logger.debug(f"feedback_classifier prompt: {prompt}")
   
    GPT = GPTHandler(api_key=env_utils.get_openai_key())
    gpt_params = {
        "max_tokens": _max_output_token_length,     # 分类任务通常只需要较少的tokens
        "temperature": 0,      # 0表示最保守的选择，输出最确定的结果
        "top_p": 0,            # 0表示选择概率最高的词
    }

    encoding = tiktoken.encoding_for_model(_GPT_model_name)
    context = GPT.run_gptModel(
        session,
        user,
        model_list_id=1,                         # table model_list
        messages=[{
            "role": "user",
            "content": prompt
        }],
        user_input=json.dumps(feedbacks, ensure_ascii=False), 
        expert_data = {  
            "expert_id": "equipment_repairman",  # table expert
            "expert_model": _GPT_model_name,     # table model_list
            "expert_model_type": 1               # table model_token_log
        },
        chat_uuid="feedback_test",
        classify="intent",                       # table model_token_log
        model=_GPT_model_name,
        params=gpt_params,
    )

    result = _str_to_dict(context)
    logger.debug(f"feedback_classifier result: {result}")

    # 回傳資料性質統計
    classified_id_set: set[int] = set()
    for v in result.values():
        classified_id_set.update(v)
    unclassified_id_list = list(set(list(feedbacks.keys())) - set(classified_id_set))
    output_len = len(classified_id_set)
    token_len = len(encoding.encode(prompt)) + len(encoding.encode(context))
    return result, unclassified_id_list, output_len, token_len, _max_output_token_length

def _test1():
    session_maker = create_session_maker(create_db_engine(450, 50))
    user: User = User({
        "name": "name_test",
        "avatar": "avatar_test",
        "sex": "sex_test",
        "user_type": "user_type_test",
        "login_type": "login_type_test",
        "is_enable": "is_enable_test",
        "login_info": {
            "login_info_test": "login_info_test"
        },
        "auth_id": {
            "auth_id_test": "auth_id_test"
        },
        "uid": "172486cb-c456-43d9-a679-e2f537acd3bc",   # table users
        "nickname": "nickname_test",
        "user_no": "user_no_test",
        "userNo": "userNo_test",
        "cookies_pool": "cookies_pool_test",
        "cookies": {
            "cookies_test": "cookies_test"
        },
        "client_ip": "client_ip_test"
    })
   
    feedbacks_input = {}
    input_set = set()
    with open("ava/utils/feedbackDataTest.json", "r", encoding="utf-8") as f:
        feedbackfile = json.load(f)
    for feedback in feedbackfile:
        feedbacks_input[str(feedback["id"])] = feedback["question"]
        input_set.add(str(feedback["id"]))

    with session_scope(session_maker) as session:
        result, x, output_len, token_len ,max_output_token_length = feedback_classifier(user, feedbacks_input, session)
        input_len = len(feedbacks_input)
        logger.debug(f"feedback_output: {result}")
        logger.debug(f"====================================")
        logger.debug(f"unclassified id: {x}")
        logger.debug(f"feedback_input_len: {input_len}")
        logger.debug(f"feedback_output_len: {output_len}")
        logger.debug(f"token_len: {token_len}")
        logger.debug(f"max_output_token_length: {max_output_token_length}")
        logger.debug(f"====================================")
    logger.debug("end test feedback_classifier") 

if __name__ == "__main__":
    logger.setLevel(logging.DEBUG)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    logger.addHandler(console_handler)
    logger.debug("start test feedback_classifier")
    _test1()