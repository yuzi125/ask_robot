import json

# 讀取 JSON 檔案
file_path = './skill.json'

# 讀取 JSON 數據
with open(file_path, 'r', encoding='utf-8') as file:
    skills = json.load(file)

# 轉換 JSON 數據為 SQL 語句
sql_statements = []

for skill in skills:
    # 處理可能為 None 的欄位
    icon = f"'{skill.get('icon')}'" if skill.get('icon') else 'NULL'

    # 將 config_jsonb 轉換為 JSON 字符串並逃逸單引號
    config_jsonb = json.dumps(skill['config_jsonb']).replace("'", "''")

    # 建立 SQL 插入語句
    sql = f"""
    INSERT INTO public.skill (
        id, name, describe, config_jsonb, class, is_enable, state, icon, create_time, update_time
    ) VALUES (
        '{skill['id']}', '{skill['name']}', '{skill['describe']}', '{config_jsonb}', 
        '{skill['class']}', {skill['is_enable']}, {skill['state']}, {icon if icon != 'NULL' else 'NULL'}, 
        '{skill['create_time']}', '{skill['update_time']}'
    );
    """
    sql_statements.append(sql.strip())

# 由於輸出可能非常長，這裡僅顯示前兩條 SQL 語句
for sql in sql_statements:
    print(sql + '\n\n')
