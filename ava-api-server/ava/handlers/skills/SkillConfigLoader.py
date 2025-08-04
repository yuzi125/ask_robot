import importlib
import json
import logging
import os
import re

from ava.clients.sql.crud import select_skill_from_id
from ava.clients.sql.schema import Skill_Schema
from ava.handlers.skills.WebAPIConfig import WebAPIConfig
from langchain_openai import ChatOpenAI

logger = logging.getLogger("ava_app")


def load_skill_runners(llm: ChatOpenAI) -> dict:
    directory = './skills'

    # List to hold the data from all JSON files
    all_skills_runner: dict = {}

    # Iterate over each file in the directory
    for filename in os.listdir(directory):
        if filename.endswith('.json'):
            filepath = os.path.join(directory, filename)
            with open(filepath, 'r', encoding="UTF8") as file:
                json_string = json.load(file)
                skill_id = re.sub(r'\.json$', '', filename)
                config = WebAPIConfig.from_json_string(json_string)
                assert skill_id == config.id, f"illegal skill id: {skill_id} vs {config.id}"
                webapi = load_skill(llm, config.pg_id)
                webapi.set_config(webapi)
                all_skills_runner[skill_id] = webapi
    return all_skills_runner


def load_skill(llm: ChatOpenAI, pg_id):
    handler_modules = importlib.import_module('ava.handlers.' + pg_id)
    class_name = re.sub(r'^\w+\.', '', pg_id)
    class_ = getattr(handler_modules, class_name)
    handler_object = class_(llm)
    logger.info(f"handler_object initialized:{class_name}!")
    return handler_object


def load_skill_config_from_db(runner, skill_id, session):
    try:
        skill: Skill_Schema | None = select_skill_from_id(skill_id=skill_id,
                                                          session=session)
        assert skill, f"Skill: '{skill_id}' not registered."
        json_string = skill.config_jsonb
        return json_string
    except Exception as error:
        logger.error(f"An error occurred: {error}")
        raise error
