from typing import List

from ava.handlers.Knowledge import *

human_template = """
    User Query: {query}

    Relevant Context: {context}
"""

inquiry_template = """
    User Query: {query}

    Relevant Context: {result}
"""

query_db_template = """
    User Query: {query}

    query result: {result}
"""


def get_classification_prompts(handlers: List[AvaHandler]):
    size = len(handlers)
    items = []
    examples_descriptions = []
    for i in range(size):
        # ht = handlers[i].get_intention_type()
        class_name = type(handlers[i]).__name__
        logger.debug(f"{i} handler = {class_name} ")
        # print(f"{i} handler.intention_type: {ht} vs {intention_type}")
        # if intention_type not in ht:
        #     continue
        intention = handlers[i].get_intention()
        items.append(f"{i}. {intention}")
        examples = handlers[i].get_examples()
        for ex in examples:
            examples_descriptions.append(f"User Input: {ex}")
            examples_descriptions.append(f"Category: {i} \n")
    body = "\n".join(items)
    examples = "\n".join(examples_descriptions)

    return f'''
You are a master at interpreting Chinese language semantics and user intent. 
Please go ahead and enter some user input sentences, and you will tell me their intent. The intent options are:

{body}

Here are some examples. 

{examples} 


User Input: $PROMPT


Finally, You will output the code for the guessed intent from the above options. 
If there is no matching intent, then Category: 99. 
Provide me with the specified answer without any additional output or explanation in the following format: 


Category: {{number}}
'''


def get_intention_type_prompt(user_input):
    return f'''
請對使用者輸入內容執行分類，若是問句，或內容全是數字，回覆 Q，若輸入帶有具體日期或時間的，回覆 E，其他請求執行系統指令等任務者，回覆 E， 

範例如下:
1. 加班後的抵休要多久申請完 => Q
2. 預計5點半到7點申請加班，準備切換上線 => E
3. 申請昨天5點半到7點半的加班 => Q
4. 35617 => Q
5. 下週二8點到10點請休假，處理私務 => E

=============
Input: {user_input}
Answer:  ? 
'''
