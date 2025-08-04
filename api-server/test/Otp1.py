import binascii
from pyDes import des, ECB, PAD_PKCS5
import base64


def encrypt(data, secret_key):
    if len(secret_key) > 8:
        secret_key = secret_key[0:8]
    k = des(secret_key, ECB, padmode=PAD_PKCS5)
    en = k.encrypt(data, padmode=PAD_PKCS5)
    strs = bytes.decode(base64.b64encode(en))
    return strs


# Example usage
plain_text = "I20496"
otp_key = "OtpSecretKey"
encrypted_data = encrypt(plain_text, otp_key)
print(encrypted_data)
