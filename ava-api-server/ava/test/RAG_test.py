from ragas.testset.generator import TestsetGenerator
from ragas.testset.evolutions import simple, reasoning, multi_context
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.document_loaders.pdf import PyPDFLoader
import os

os.environ["OPENAI_API_KEY"] = "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"

file_path = os.path.join(os.getcwd(), "ava-api-server/ava/test/第六章 超時工作.pdf")
loader = PyPDFLoader(file_path)
documents = loader.load()

for document in documents:
    document.metadata['filename'] = document.metadata['source']
# generator with openai models
generator_llm = ChatOpenAI(model="gpt-3.5-turbo-0125")
critic_llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
embeddings = OpenAIEmbeddings()

generator = TestsetGenerator.from_langchain(
    generator_llm,
    critic_llm,
    embeddings
)

# generate testset
testset = generator.generate_with_langchain_docs(documents, test_size=1, distributions={simple: 0.5, reasoning: 0.25, multi_context: 0.25})
print(testset.to_pandas())