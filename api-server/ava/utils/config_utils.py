import os
import yaml

env = os.getenv('ENVIRONMENT')
if env is None:
    raise ValueError("Env variable: `ENVIRONMENT` is Empty")

with open(f'./ava-api-server/config/ava_config.{env}.yaml',
          'r',
          encoding='utf-8') as f:
    config = yaml.safe_load(f)


def get_suggestion():
    return config['suggest_question']


def set_value_if_not_empty(obj, fields, param_data):
    for field in fields:
        if param_data.get(field) is not None:
            setattr(obj, field, param_data.get(field))
    return obj
