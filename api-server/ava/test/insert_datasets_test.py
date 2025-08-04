import json

# 讀取 JSON 檔案
file_path = './datasets.json'

# 讀取 JSON 數據
with open(file_path, 'r', encoding='utf-8') as file:
    datasets = json.load(file)

# 轉換 JSON 數據為 SQL 語句

# 轉換 JSON 數據為 SQL 語句以適配 public.datasets 表結構
sql_statements_datasets = []

for dataset in datasets:  # 使用前面讀取的 expert 變數作為示例，應該替換為正確的變數名
    # 處理可能為 None 的欄位
    icon = f"'{dataset.get('icon')}'" if dataset.get('icon') else 'NULL'
    
    # 將 config_jsonb 轉換為 JSON 字符串並逃逸單引號
    config_jsonb = 'NULL' if dataset['config_jsonb'] is None else f"'{json.dumps(dataset['config_jsonb']).replace("'", "''")}'"
    describe = dataset.get('describe', 'NULL')
    if describe != 'NULL':
        describe = f"'{describe.replace("'", "''")}'"

    # 建立 SQL 插入語句
    sql = f"""
    INSERT INTO public.datasets (
        id, name, describe, config_jsonb, folder_name, is_enable, state, icon, create_time, update_time
    ) VALUES (
        '{dataset['id']}', '{dataset['name']}', {describe}, {config_jsonb}, 
        '{dataset['folder_name']}', {dataset['is_enable']}, {dataset['state']}, {icon}, 
        '{dataset['create_time']}', '{dataset['update_time']}'
    );
    """
    sql_statements_datasets.append(sql.strip())

# 由於輸出可能非常長，這裡僅顯示前兩條 SQL 語句
for sql in sql_statements_datasets[:]:  # 僅示範打印前兩條
    print(sql + '\n\n')
