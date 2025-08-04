import os
import shutil

from dotenv import load_dotenv

env = os.getenv('ENVIRONMENT', 'dev')
load_dotenv('.env.' + env, override=False)


def get_key(key):
    return os.getenv(key)


def set_key(new_key, new_value):
    # TOKEN_CACHE[key] = value
    os.environ[new_key] = new_value
    with open(".env.new", "w") as f:
        for key, value in os.environ.items():
            if key.startswith("AVA_") or key == "OPENAI_API_KEY":
                if key == new_key:
                    f.write(f"{key}={new_value}\n")
                else:
                    f.write(f"{key}={value}\n")
    shutil.move(".env.new", ".env")


def set_tdx_access_token(token):
    set_key("AVA_TDX_ACCESS_TOKEN", token)


def get_chromadb_host():
    return get_key("CHROMADB_HOST")


def get_mas_cookies():
    return get_key("AVA_MAS_COOKIES")


def get_openai_key():
    return get_key("OPENAI_API_KEY")


def get_flask_secret_key():
    return get_key("FLASK_SECRET_KEY")


def get_test_cookies():
    return get_key("AVA_TEST_COOKIES")


def get_prod_cookies():
    return get_key("AVA_PROD_COOKIES")


def get_sql_page():
    return get_key("SQL_PAGE")


def get_aord_sso():
    return get_key("AORD_SSO")


def get_tdx_client_id():
    return get_key("AVA_TDX_CLIENT_ID")


def get_tdx_client_secret():
    return get_key("AVA_TDX_CLIENT_SECRET")


def get_tdx_access_token():
    return get_key("AVA_TDX_ACCESS_TOKEN")


def get_ava_backend_url():
    return get_key("AVA_BACKEND_URL")


def get_redis_host():
    return get_key("REDIS_HOST") or "localhost"


def get_redis_port():
    try:
        port = get_key("REDIS_PORT")
        if port is None:
            return 6379
        return int(port)
    except ValueError:
        return 6379


def get_redis_password():
    return get_key("REDIS_PASSWORD") or "DEFAULT_REDIS_PASSWORD"


def get_google_api_key():
    return get_key("GOOGLE_API_KEY")


def get_openrouter_api_key():
    """
    獲取 OpenRouter API 密鑰。
    請在環境變量中設置 OPENROUTER_API_KEY。
    """
    return get_key("OPENROUTER_API_KEY")
