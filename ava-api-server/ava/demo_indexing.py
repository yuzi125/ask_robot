import os

import streamlit as st
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.vectorstores import Chroma

os.environ["OPENAI_API_KEY"] = st.secrets["OPENAI_API_KEY"]

# Set persist directory
persist_directory = 'db'

hd_loader = DirectoryLoader('../docs/hd/', glob="*.pdf")
contracts_loader = DirectoryLoader('../docs/contracts/', glob="*.pdf")
bizTip_loader = DirectoryLoader('../docs/biztrip/', glob="*.pdf")

hd_docs = hd_loader.load()
contracts_docs = contracts_loader.load()
bizTrip_docs = bizTip_loader.load()

embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
text_splitter = CharacterTextSplitter(chunk_size=250, chunk_overlap=8)

# Split documents and generate embeddings
hd_docs_split = text_splitter.split_documents(hd_docs)
contracts_docs_split = text_splitter.split_documents(contracts_docs)
bizTrip_docs_split = text_splitter.split_documents(bizTrip_docs)

# Create Chroma instances and persist embeddings
hdDB = Chroma.from_documents(hd_docs_split, embeddings, persist_directory=os.path.join(persist_directory, 'hd'))
hdDB.persist()
#
# contractsDB = Chroma.from_documents(contracts_docs_split, embeddings, persist_directory=os.path.join(persist_directory, 'contracts'))
# contractsDB.persist()

# bizTripDB = Chroma.from_documents(bizTrip_docs_split, embeddings, persist_directory=os.path.join(persist_directory, 'biztrip'))
# bizTripDB.persist()

