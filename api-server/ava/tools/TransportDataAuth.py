import logging

import requests, os
from dotenv import load_dotenv
from ..utils import env_utils

load_dotenv()
url = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"

TDX_CLIENT_ID = env_utils.get_tdx_client_id()
TDX_CLIENT_SECRET = env_utils.get_tdx_client_secret()

# print(f"client-id:{TDX_CLIENT_ID}")
# print(f"client-secret:{TDX_CLIENT_SECRET}")

payload = {
    'grant_type': 'client_credentials',
    'client_id': TDX_CLIENT_ID,
    'client_secret': TDX_CLIENT_SECRET
}

headers = {
    'content-type': 'application/x-www-form-urlencoded'
}


def refresh_token():
    response = requests.post(url, data=payload, headers=headers)
    resp = response.json()
    if resp.get("access_token") is not None:
        token = resp.get('access_token')
        return token
    else:
        logging.error(f"error on refreshing token: {resp}")
        logging.error(f"TDX_CLIENT_ID: {TDX_CLIENT_ID}, \n TDX_CLIENT_SECRET:{TDX_CLIENT_SECRET}")
        raise ValueError("error on refreshing token")

    # print( response )

    # The access token is available in the response's json under the 'access_token' key
    # print("----------")
    # print(access_token)
    # print("----------")
