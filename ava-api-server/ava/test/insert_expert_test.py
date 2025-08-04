import json

# 讀取 JSON 檔案
file_path = './expert.json'

# 讀取 JSON 數據
with open(file_path, 'r', encoding='utf-8') as file:
    experts = json.load(file)

# 轉換 JSON 數據為 SQL 語句
sql_statements = []

sql_statements_expert = []

for expert in experts:
    prompt = 'NULL' if expert['prompt'] is None else f"'{expert['prompt'].replace("'", "''")}'"
    config_jsonb = 'NULL' if expert['config_jsonb'] is None else f"'{json.dumps(expert['config_jsonb']).replace("'", "''")}'"
    avatar = f"'{expert['avatar']}'" if expert['avatar'] else 'NULL'

    sql = f"""
    INSERT INTO public.expert (
        id, name, welcome, avatar, url, config_jsonb, is_enable, state, permission, prompt, create_time, update_time
    ) VALUES (
        '{expert['id']}', '{expert['name']}', '{expert['welcome']}', {avatar},
        '{expert['url']}', {config_jsonb}, {expert['is_enable']}, {expert['state']}, 0,
        {prompt}, '{expert['create_time']}', '{expert['update_time']}'
    );
    """
    sql_statements_expert.append(sql.strip())

# 打印出生成的 SQL 語句
for sql in sql_statements_expert[:]:  # 僅示範打印前兩條
    print(sql + '\n\n')
