# file_upload.py
import json
import logging
import os

from ava.utils.redis_utils import get_redis_client_with_retry
from flask import jsonify, request
from redis import Redis

logger = logging.getLogger("ava_app")


def upload_files():
    logger.info("Start Uploading files... ")
    uploaded_files = request.files.getlist('files')
    folder_name = request.form.get('folder_name', None)

    file_infos = request.form.get('file_infos', None)
    try:
        file_infos = json.loads(file_infos)
    except Exception as e:
        logger.error(f"Error parsing file_infos: {e}")
        file_infos = None
    """
   {
        "folder_name": "folder",
        "file_infos": {
            "key":{
                "filename": "key",
                "originalname": "file1.csv",
                "datasource_url": "datasource1",
                "datasource_name": "datasource1",
                "upload_documents_id": "updload_document_id1",
                "datasets_id": "datasets_id1",
                "upload_folder_id": "upload_folder_id1",
                "datasource_type": "A",
            }
        }
    }
    """
    # filenames = request.form.getlist('filenames')
    # original_names = request.form.getlist('originalnames')
    # datasource_urls = request.form.getlist('datasource_urls')
    # datasource_names = request.form.getlist('datasource_names')

    # 檢查 datasource 是否存在，若不存在則建立一個全為空字符串的列表
    # if not datasource or len(datasource) != len(filenames):
    #     datasource = [""] * len(filenames)

    if folder_name is None:
        return jsonify({
            'status': 'fail',
            'message': 'folder_name is required',
            'code': 400,
            'data': []
        })
    if file_infos is None:
        return jsonify({
            'status': 'fail',
            'message': 'file_infos is required',
            'code': 400,
            'data': []
        })
    upload_folder = f'./docs/{folder_name}/'

    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)

    # redis_mapping_key: str = f"ava:file_upload_{folder_name}"
    # redis_lock_key: str = f"ava:file_upload_lock_{folder_name}"

    # redis_client: Redis = get_redis_client_with_retry()

    # with redis_client.lock(redis_lock_key, timeout=60,
    #                        blocking_timeout=60) as lock:
    #     if not redis_client.exists(redis_mapping_key):
    #         redis_client.hset(redis_mapping_key,
    #                           mapping={"placeholder":
    #                                    "_"})  # 初始化 mapping 留的佔位 key value

    mapping_file_path = f'./docs/{folder_name}/mapping.json'

    # 讀取已經存在的 mapping
    # if os.path.exists(mapping_file_path):
    #     with open(mapping_file_path, 'r', encoding="utf-8") as mapping_file:
    #         existing_mapping = json.load(mapping_file)
    # else:
    #     with open(mapping_file_path, "w", encoding="utf-8") as f:
    #         f.write("")
    #     existing_mapping = {}

    # for key, file_info in file_infos.items():
    #     redis_client.hset(redis_mapping_key, key, json.dumps(file_info))
    #     logger.info(f"FileUpload mapping updated: {key} -> {file_info}")
    # existing_mapping[key] = file_info

    # with open(mapping_file_path, 'w', encoding="utf-8") as mapping_file:
    #     json.dump(existing_mapping, mapping_file)
    #     logger.info(
    #         f"Mapping updated and written to {mapping_file_path} {existing_mapping}"
    #     )
    try:
        for uploaded_file, file_info in zip(uploaded_files,
                                            file_infos.values()):
            if uploaded_file and uploaded_file.filename != '':
                file_path = os.path.join(upload_folder, file_info["filename"])
                uploaded_file.save(file_path)
    except Exception as e:
        logger.error(f"Error saving files: {e}")
        return jsonify({
            'status': 'fail',
            'message': f'Error saving files',
            'code': 400,
            'data': []
        })
    else:
        return jsonify({
            'status': 'success',
            'message': 'Files uploaded successfully',
            'code': 200,
            'data': list(file_infos.keys())
        })
    # finally:
    #     redis_client.close()
