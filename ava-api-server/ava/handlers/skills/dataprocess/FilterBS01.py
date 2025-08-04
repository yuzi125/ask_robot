from ava.handlers.skills.CommonConfig import Schema
from ava.handlers.skills.dataprocess.AvaDataFilter import AvaDataFilter

stock_lists = {
    "台積電": "2330",
    "中鋼": "2002",
    "台塑": "1301",
    "聯發科": "2454",
    "華碩": "2357",
    "中華電": "2412",
    "友達": "2409"
}

strategy_lists = {
    "等比例": "eq_ratio"
}

def get_code_mapping(code_name, data_list, name):
    id = data_list.get(name)
    if id is None:
        raise ValueError(f"{code_name}[{name}] 查無對應代號")
    return id

def extract_num(period_str):
    pass

class FilterBS01(AvaDataFilter):
    def before_post(self, input_data, schema: Schema):
        stock_names = input_data["stock_names"]
        input_data["stock_ids"] = [get_code_mapping("股票", stock_lists, stock_name) for stock_name in stock_names]
        input_data["buying_strategy"] = get_code_mapping("投入比例", strategy_lists, input_data["buying_strategy"])
        # input_data["buying_period"] =

    def after_post(self, input_data, schema: Schema, resp):
        pass
