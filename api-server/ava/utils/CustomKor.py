from typing import Any


def generate_example(example_data:list[dict[str,Any]],schema_ids:list[str]) -> list[tuple[str, str]]:
    input_output_examples:list[tuple[str,str]] = []
    for entry in example_data:
        input_str:str = entry['input']
        fields:dict = entry['fields']
        output_str:str = "|".join([fields[id] for id in schema_ids])
        input_output_examples.append((input_str, output_str))
    return input_output_examples

def generate_prompt(*,user_input:str, schema_id:str,schema_description:str,parameter:list[dict[str,Any]],example:list[dict[str,Any]]) -> str:
    instructions = "Your goal is to extract structured information from the user's input that matches the form described below. When extracting information please make sure it matches the type information exactly. Do not add any attributes that do not appear in the schema shown below."
    typescript_block = f"```TypeScript\n\n{schema_id}: {{ // {schema_description}\n"
    for item in parameter:
        typescript_block += f" {item['id']}: string // {item["description"]}\n"
    typescript_block += f"}}\n```"
    input_output_prompt = "Please output the extracted information in CSV format in Excel dialect. Please use a | as the delimiter. \n Do NOT add any clarifying information. Output MUST follow the schema above. Do NOT add any additional columns that do not appear in the schema."
    input_output_block = ""
    for _ex in generate_example(example, [d["id"] for d in parameter]):
        input_str, output_str = _ex
        input_output_block += f"Input: {input_str}\nOutput: {"|".join([d["id"] for d in parameter])}\r\n"
        input_output_block += f"{output_str}\r\n\n"
    prompt = f"{instructions}\n\n{typescript_block}\n\n\n\n{input_output_prompt}\n\n\n\n{input_output_block}\nInput: {user_input}\nOutput:"
    return prompt

def process_result(llm_result:str,schema_id:str) -> list[dict[str, str]]:
    # 下面這些 replace 都是為了語言模型亂回答準備的
    llm_result = llm_result.replace('```', '')
    llm_result = llm_result.replace('plaintext\n', '')
    llm_result = llm_result.replace('csv\n', '')
    llm_result = llm_result.replace(f"{schema_id}\n", '')
    lines: list[str] = llm_result.strip().splitlines()
    headers: list[str] = lines[0].split('|')
    headers = [header.strip() for header in headers]
    if len(lines) == 1:
        # 這邊是為了處理語言模型在全部 parameter 不吻合時亂回答的情況，所以自己生
        values = ['' for _ in headers]    
        data_dict = [dict(zip(headers, values))]
    else:
        data_dict = [dict(zip(headers, values)) for values in [line.split('|') for line in lines[1:]]]
    return data_dict