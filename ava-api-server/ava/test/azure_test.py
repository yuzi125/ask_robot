import os
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
os.environ["AZURE_OPENAI_API_KEY"] = "c7afab32886a403d8119a04fbf7830f0"
os.environ["AZURE_OPENAI_ENDPOINT"] = "https://csc-f35-openai-eastus2.openai.azure.com/"
os.environ["AZURE_OPENAI_API_VERSION"] = "2024-05-01-preview"
os.environ["AZURE_OPENAI_CHAT_DEPLOYMENT_NAME"] = "gpt-4o"
print(f"API Key: {os.environ['AZURE_OPENAI_API_KEY']}")
print(f"Endpoint: {os.environ['AZURE_OPENAI_ENDPOINT']}")
print(f"API Version: {os.environ['AZURE_OPENAI_API_VERSION']}")
print(f"Deployment Name: {os.environ['AZURE_OPENAI_CHAT_DEPLOYMENT_NAME']}")

model = AzureChatOpenAI(
    openai_api_version=os.environ["AZURE_OPENAI_API_VERSION"],
    azure_deployment=os.environ["AZURE_OPENAI_CHAT_DEPLOYMENT_NAME"],
)

message = HumanMessage(
    content="Translate this sentence from English to French. I love programming."
)

try:
    response = model.invoke([message])
    print(response)
except Exception as e:
    print(f"發生錯誤: {e}")
