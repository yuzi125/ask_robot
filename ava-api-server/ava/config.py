# -*- coding:utf-8 -*-
import os
import dotenv
from typing import Any

dotenv.load_dotenv(override=False)

DEFAULTS = {
    'COOKIE_HTTPONLY': 'True',
    'COOKIE_SECURE': 'True',
    'COOKIE_SAMESITE': 'None',
    'DB_USERNAME': 'postgres',
    'DB_PASSWORD': '',
    'DB_HOST': 'localhost',
    'DB_PORT': '5432',
    'DB_DATABASE': 'dify',
    'REDIS_HOST': 'localhost',
    'REDIS_PORT': '6379',
    'REDIS_DB': '0',
    'REDIS_PASSWORD': "DEFAULT_REDIS_PASSWORD",
    'REDIS_USE_SSL': 'False',
    'SESSION_REDIS_HOST': 'localhost',
    'SESSION_REDIS_PORT': '6379',
    'SESSION_REDIS_DB': '2',
    'SESSION_REDIS_USE_SSL': 'False',
    'OAUTH_REDIRECT_PATH': '/console/api/oauth/authorize',
    'OAUTH_REDIRECT_INDEX_PATH': '/',
    'CONSOLE_WEB_URL': 'https://cloud.ava.ai',
    'CONSOLE_API_URL': 'https://cloud.ava.ai',
    'SERVICE_API_URL': 'https://api.ava.ai',
    'APP_WEB_URL': 'https://udify.app',
    'APP_API_URL': 'https://udify.app',
    'STORAGE_TYPE': 'local',
    'STORAGE_LOCAL_PATH': 'storage',
    'CHECK_UPDATE_URL': 'https://updates.ava.ai',
    'SESSION_TYPE': 'sqlalchemy',
    'SESSION_PERMANENT': 'True',
    'SESSION_USE_SIGNER': 'True',
    'DEPLOY_ENV': 'PRODUCTION',
    'SQLALCHEMY_POOL_SIZE': 30,
    'SQLALCHEMY_ECHO': 'False',
    'SENTRY_TRACES_SAMPLE_RATE': 1.0,
    'SENTRY_PROFILES_SAMPLE_RATE': 1.0,
    'WEAVIATE_GRPC_ENABLED': 'True',
    'WEAVIATE_BATCH_SIZE': 100,
    'CELERY_BACKEND': 'database',
    'PDF_PREVIEW': 'True',
    'LOG_LEVEL': 'INFO',
    'DISABLE_PROVIDER_CONFIG_VALIDATION': 'False',
    'DEFAULT_LLM_PROVIDER': 'openai',
    'OPENAI_HOSTED_QUOTA_LIMIT': 200,
    'ANTHROPIC_HOSTED_QUOTA_LIMIT': 1000,
    'TENANT_DOCUMENT_COUNT': 100,
    'MODEL_PARAMS': {
        "max_tokens": 1200,
        "temperature": 0,
        "frequency_penalty": 0,
        "top_p": 1.0,
    },
    "search_kwargs": {
        "k": 5,
        "score_threshold": 0.4,
        "cache_threshold": 0.75,
    },
    "EMBEDDING_MODEL": "text-embedding-3-large",
    "API_DATABASE_POOL_SIZE": 150,
    "API_DATABASE_MAX_OVERFLOW": 50,
    "VECTOR_DATABASE_POOL_SIZE": 10,
    "VECTOR_DATABASE_MAX_OVERFLOW": 0,
    "REDIS_CHANNEL_NAME": "HANDLER_REFRESH"
}


def _get_vector_database_pool_size() -> int:
    return int(
        get_env("VECTOR_DATABASE_POOL_SIZE")
        or DEFAULTS["VECTOR_DATABASE_POOL_SIZE"])


def _get_vector_database_max_overflow() -> int:
    return int(
        get_env("VECTOR_DATABASE_MAX_OVERFLOW")
        or DEFAULTS["VECTOR_DATABASE_MAX_OVERFLOW"])


def _get_database_pool_size() -> int:
    return int(
        get_env("API_DATABASE_POOL_SIZE")
        or DEFAULTS["API_DATABASE_POOL_SIZE"])


def _get_database_max_overflow() -> int:
    return int(
        get_env("API_DATABASE_MAX_OVERFLOW")
        or DEFAULTS["API_DATABASE_MAX_OVERFLOW"])


def get_search_kwargs_or_default(obj: dict, key: str) -> Any:
    if not key in DEFAULTS["search_kwargs"]:
        return None

    default_value = DEFAULTS["search_kwargs"][key]
    return obj['search_kwargs'].get(key, default_value) or default_value


def get_env(key: str) -> str:
    return os.environ.get(key, DEFAULTS.get(key) or "")


def get_bool_env(key: str) -> bool:
    return get_env(key).lower() == 'true'


def get_cors_allow_origins(env: str, default: str) -> list[str]:
    cors_allow_origins = []
    if get_env(env):
        for origin in get_env(env).split(','):
            cors_allow_origins.append(origin)
    else:
        cors_allow_origins = [default]

    return cors_allow_origins


class Config:
    """Ava Server Application configuration class."""

    def __init__(self):
        self.DEPLOY_ENV = get_env('DEPLOY_ENV')
        self.SECRET_KEY = get_env('SECRET_KEY')
        self.SESSION_TYPE = get_env('SESSION_TYPE')
        self.REDIS_HOST = get_env('REDIS_HOST')
        self.REDIS_PORT = get_env('REDIS_PORT')
        self.SESSION_KEY_PREFIX = get_env('SESSION_KEY_PREFIX')
        self.REDIS_PASSWORD = get_env('REDIS_PASSWORD')
        self.REDIS_DB = get_env('REDIS_DB')
        self.REDIS_CHANNEL_NAME = get_env('REDIS_CHANNEL_NAME')
        self.EMBEDDING_MODEL = get_env('EMBEDDING_MODEL')
        self.DATABASE_MAX_OVERFLOW = _get_database_max_overflow()
        self.DATABASE_POOL_SIZE = _get_database_pool_size()
        self.VECTOR_DATABASE_MAX_OVERFLOW = _get_vector_database_max_overflow()
        self.VECTOR_DATABASE_POOL_SIZE = _get_vector_database_pool_size()
        self.MODEL_PARAMS = DEFAULTS["MODEL_PARAMS"]


class TestConfig(Config):

    def __init__(self):
        super().__init__()
        self.EDITION = "SELF_HOSTED"
        self.TESTING = True
        # use a different database for testing: dify_test
        self.SQLALCHEMY_DATABASE_URI = get_env("DB_CONNECTION_STRING")
        self.SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
