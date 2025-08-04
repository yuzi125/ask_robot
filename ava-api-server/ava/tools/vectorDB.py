import logging
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

import os

logger = logging.getLogger("ava_app")


def delete_vectorDb_data(folder_name, key, value):
    try:
        vector_db = Chroma(
            persist_directory=os.path.join("db", folder_name),
            embedding_function=OpenAIEmbeddings(),
        )
        count_before = vector_db._collection.count()
        logger.info(f"delete_vectorDb_data count before {count_before}")
        vector_db._collection.delete(where={key:value})
        count_after = vector_db._collection.count()
        logger.info(f"delete_vectorDb_data count after {count_after}")
        vector_db.persist()

        return {
            "status": "success",
            "code": 200,
            "message": "delete success",
            "data": {
                "search_key": key,
                "search_value": value,
                "count_before": count_before,
                "count_after": count_after,
            },
        }
    except Exception as e:
        logger.error(f"Error search_key:{key} , search_value:{value} e: {e}")
        return {"status": "fail", "code": 500, "message": f"No matching data to delete {e}"}