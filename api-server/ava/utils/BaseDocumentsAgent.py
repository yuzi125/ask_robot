import os
import json
import logging
import urllib.request
import fitz
import base64
from PIL import Image
from io import BytesIO
from typing import Any, Generator
from abc import ABC, abstractmethod

from ava.clients.sql.crud import select_settings_from_key
from ava.utils import env_utils
from ava.utils.return_message_style import error_msg
from ava.prompts.file_prompts import get_default_prompt_map, get_single_file_prompt, get_default_prompt
from ava.model.dscom import User

logger = logging.getLogger("ava_app")

class BaseDocumentsAgent(ABC):
    def __init__(self, client):
        self.client = client

    def handle(self, *, session, chat_uuid: str, user: User, message_data: list[dict[str, Any]],
                user_input: str, expert_data: dict[str, Any], model_list_id: int, model_name: str,
                history_message_id: str, expert_system_prompt: str, model_params: dict[str, Any]):
        try:
            file_names = []
            # 上傳檔案
            ori_file_names, file_names, return_path = self.process_files(message_data)

            # 前端通知階段（共用的 yield）
            yield from self.yield_pre_response("-1", return_path) # 因為是走隧道模式，讓前端直接將hmi改為undefined

            # 構造 prompt
            if expert_system_prompt:
                system_prompt = expert_system_prompt
            else:
                system_prompt = self.build_prompt(user_input, ori_file_names, model_list_id, session)

            # 呼叫模型並回應（由子類負責）
            yield from self.generate_model_response(
                session=session,
                chat_uuid=chat_uuid,
                user=user,
                user_input=user_input,
                expert_data=expert_data,
                model_list_id=model_list_id,
                model_name=model_name,
                history_message_id=history_message_id,
                file_names=file_names,
                ori_file_names=ori_file_names,
                system_prompt=system_prompt,
                model_params=model_params
            )

        except Exception as e:
            logger.error(f"BaseDocumentsAgent unexpected error, ex: {e}")
            yield error_msg("發生錯誤，若有問題請聯繫管理員。")
            yield "</end>"
        finally:
            for path in file_names:
                try:
                    if os.path.exists(path):
                        os.remove(path)
                except Exception as e:
                    logger.warning(f"清除暫存檔失敗：{path}, {e}")            

    def process_files(self, message_data):
        ori_file_names = []
        file_names = []
        return_path = []

        for i, uploaded_files_url in enumerate(message_data, start=1):
            if "name" in uploaded_files_url:
                ori_file_names.append(uploaded_files_url["name"])
            else:
                ori_file_names.append(f"文件{i}")
            return_path.append({"path": uploaded_files_url["path"]})
            full_path = os.path.join("uploads", uploaded_files_url["path"])
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            file_service_url = env_utils.get_key("AVA_FILE_SERVICE_URL")
            file_name = urllib.request.urlretrieve(
                f"{file_service_url}/{uploaded_files_url['path']}",
                full_path)
            file_names.append(file_name[0])

        return ori_file_names, file_names, return_path

    def yield_pre_response(self, history_message_id, return_path):
        yield json.dumps({"state": "QA"})
        yield "</end>"
        yield json.dumps({"type": "tunnel"})
        yield "</end>"
        yield json.dumps({"state": "QA", "data": return_path})
        yield "</end>"
        yield json.dumps({"type": "hmi"})
        yield "</end>"
        yield history_message_id
        yield "</end>"
        yield json.dumps({"type": "data"})
        yield "</end>"

    def build_prompt(self, user_input: str, ori_file_names: list[str], model_list_id: int, session) -> str:
        default_prompt = get_default_prompt()
        single_file_prompt = get_single_file_prompt()
        default_prompt_map = get_default_prompt_map()

        if len(ori_file_names) > 1:
            try:
                intention_key = self.intention_analysis(user_input=user_input, model_list_id=model_list_id, session=session)
                settings_row = select_settings_from_key(key="document_agent_prompt", session=session)
                if settings_row:
                    prompt_map = json.loads(settings_row.value.strip())
                else:
                    prompt_map = default_prompt_map
            except Exception as e:
                logger.error(f"intention_analysis error: {e}")
                prompt_map = default_prompt_map
                intention_key = "other"

            system_prompt = prompt_map.get(intention_key.strip(), default_prompt)
            if ori_file_names:
                return system_prompt.format(
                    filename_1=ori_file_names[0],
                    filename_2=ori_file_names[1])
            return system_prompt.format(filename_1="文件1", filename_2="文件2")
        else:
            return single_file_prompt.format(filename_1=ori_file_names[0] if ori_file_names else "文件")

    @abstractmethod
    def generate_model_response(self, *, session, chat_uuid: str, user: User, user_input: str, expert_data: dict[str, Any],
                                 model_list_id: int, model_name: str,history_message_id: str, file_names: list[str],
                                 ori_file_names: list[str], system_prompt: str, model_params: dict[str, Any]) -> Generator[str, None, None]:
        pass

    @abstractmethod
    def intention_analysis(self, *, user_input: str, model_list_id: int, session) -> str:
        pass

    @staticmethod
    def pdf_to_image_base64_data_urls(pdf_path, zoom=2, max_size=1024):
        data_urls = []
        with fitz.open(pdf_path) as doc:
            # save_dir = ''
            # os.makedirs(save_dir, exist_ok=True)

            for page_num in range(len(doc)):
                page: fitz.Page = doc.load_page(page_num)
                matrix = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=matrix) # type: ignore

                # 存圖debug用
                # debug_path = os.path.join(save_dir, f"page_{page_num + 1}_orig.png")
                # pix.save(debug_path)

                # PIL 處理縮圖
                img_bytes = pix.tobytes("png")
                img = Image.open(BytesIO(img_bytes))
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

                with BytesIO() as buffer:
                    img.save(buffer, format="PNG")
                    base64_data = base64.b64encode(buffer.getvalue()).decode("utf-8")
                data_url = f"data:image/png;base64,{base64_data}"
                data_urls.append(data_url)

                # 清理記憶體
                del pix
                del img

        return data_urls    