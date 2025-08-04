import os
import json
import shutil

from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
import requests
import logging
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader, Docx2txtLoader, UnstructuredWordDocumentLoader

logger = logging.getLogger(__name__)


class Document:
    def __init__(self, page_content, metadata):
        self.page_content = page_content
        self.metadata = metadata




def perform_indexing():
    try:
        persist_directory = f'./db/test'
        directory_path = f'./docs/test'

    except Exception as e:
        logger.error(f"An error occurred during indexing: {e}")