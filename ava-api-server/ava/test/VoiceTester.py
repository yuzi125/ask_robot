import openai
import os

from ..utils import env_utils

openai.api_key = env_utils.get_openai_key()

def test_voice():
    openai.api_key = os.getenv("OPENAI_API_KEY")
    file = open("./file-ok.wav", "rb")
    transcription = openai.Audio.transcribe("whisper-1", file)
    print(transcription.text)

test_voice()
