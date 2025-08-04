const updatedb = require("../db-update");
const js_title = ["建立重建後表的預設資料"];

const js_program = async function () {
    let rsArr = [];
    try {
        const sqlArr = [
            `ALTER SYSTEM SET max_connections = 200;`,
            `INSERT INTO public.user_type (type_name, type_value) VALUES
            ('遊客', 'guest'),
            ('member', 'member'),
            ('webapi', 'webapi');
            `,
            `INSERT INTO public.settings
            ("key", value, create_time, update_time)
            VALUES('precise_cache_mode', '1', '2024-07-22 16:25:57.506', '2024-07-22 16:30:45.634');`,
            `INSERT INTO public.settings
            ("key", value)
            VALUES('system_bulletin', '');
            INSERT INTO public.settings
            ("key", value)
            VALUES('system_bulletin_color', '');
            INSERT INTO public.settings
            ("key", value)
            VALUES('system_bulletin_color_back', '');
            INSERT INTO public.settings
            ("key", value, create_time, update_time)
            VALUES('system_client_theme', '', '2024-04-01 17:06:00.480', '2024-04-01 17:06:15.532');
            INSERT INTO public.settings
            ("key", value, create_time, update_time)
            VALUES('system_client_theme_default', 'dark', '2024-04-01 17:27:34.731', '2024-04-02 10:22:16.155');
            INSERT INTO public.settings
            ("key", value, create_time, update_time)
            VALUES('is_db_ready', '1', '2024-04-02 11:05:51.106', '2024-04-02 11:05:51.106');
            INSERT INTO public.settings
            ("key", value, create_time, update_time)
            VALUES('guest_enable', '0', '2024-04-02 11:07:57.996', '2024-04-02 11:07:57.996');
            INSERT INTO public.settings
            ("key", value, create_time, update_time)
            VALUES('need_login', '0', '2024-05-02 10:13:30.062', '2024-05-02 10:13:30.062');

            `,
            `INSERT INTO public.datasource_type
            (id, mark, "name")
            VALUES('A', '手動上傳', 'upload');
            INSERT INTO public.datasource_type
            (id, mark, "name")
            VALUES('B', '爬蟲', 'crawler');`,
            `INSERT INTO public.settings
            ("key", value)
            VALUES('default_expert_model_config', '{
                "model": "claude-3-haiku-20240307",
                "examples": [],
                "intention": "",
                "model_params": {
                    "top_p": 1,
                    "max_tokens": 1200,
                    "temperature": 0,
                    "frequency_penalty": 0
                },
                "search_kwargs": {
                    "k": 5,
                    "parent_score_threshold": 0.3,
                    "child_score_threshold": 0.3,
                    "parent_chunk_size":700,
                    "child_chunk_size": 140
                },
                "system_prompt": "只要有回答答案，一定要使用markdown超連結語法附上來源",
                "embedding_model": "text-embedding-3-large",
                "content_replacement_list": "{}",
                "no_data_found": ""
            }');`,
            `INSERT INTO public.settings
            ("key", value)
            VALUES('is_record_tunnel_form', '1');`,
            `INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(1, 'gpt-4o', 'openai', 'gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(2, 'gpt-4', 'openai', 'gpt-4', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.03, 0.06);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(3, 'gpt-4-turbo', 'openai', 'gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(4, 'gpt-3.5-turbo', 'openai', 'gpt-3.5-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 0, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(5, 'azure-gpt-4o', 'azure', 'azure-gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(6, 'azure-gpt-4-turbo', 'azure', 'azure-gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(7, 'azure-gpt-4-32k', 'azure', 'azure-gpt-4-32k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.06, 0.12);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(8, 'azure-gpt-35-turbo-16k', 'azure', 'azure-gpt-35-turbo-16k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.004);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(9, 'azure-gpt-35-turbo', 'azure', 'azure-gpt-35-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(10, 'claude-3-haiku-20240307', 'anthropic', 'claude-3-haiku-20240307', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0025, 0.00125);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(11, 'twcc-ffm-llama3-70b-chat', 'twcc', 'twcc-ffm-llama3-70b-chat', '{"top_p": 1, "max_tokens": 1200, "temperature": 0.1, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0.1}'::jsonb, 1, 'search', '2024-07-08 11:22:42.486', '2024-07-08 11:22:42.486', 0.0, 0.0);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(12, 'caf-azure-gpt-4o', 'caf-azure', 'caf-azure-gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(13, 'caf-azure-gpt-4-turbo', 'caf-azure', 'caf-azure-gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(14, 'caf-azure-gpt-4-32k', 'caf-azure', 'caf-azure-gpt-4-32k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.06, 0.12);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(15, 'caf-azure-gpt-35-turbo-16k', 'caf-azure', 'caf-azure-gpt-35-turbo-16k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.004);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(16, 'caf-azure-gpt-35-turbo', 'caf-azure', 'caf-azure-gpt-35-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(17, 'gpt-4o', 'openai', 'gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(18, 'gpt-4', 'openai', 'gpt-4', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.03, 0.06);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(19, 'gpt-4-turbo', 'openai', 'gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(20, 'gpt-3.5-turbo', 'openai', 'gpt-3.5-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 0, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(21, 'azure-gpt-4o', 'azure', 'azure-gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(22, 'azure-gpt-4-turbo', 'azure', 'azure-gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(23, 'azure-gpt-4-32k', 'azure', 'azure-gpt-4-32k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.06, 0.12);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(24, 'azure-gpt-35-turbo-16k', 'azure', 'azure-gpt-35-turbo-16k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.004);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(25, 'azure-gpt-35-turbo', 'azure', 'azure-gpt-35-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(26, 'claude-3-haiku-20240307', 'anthropic', 'claude-3-haiku-20240307', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0025, 0.00125);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(27, 'twcc-ffm-llama3-70b-chat', 'twcc', 'twcc-ffm-llama3-70b-chat', '{"top_p": 1, "max_tokens": 1200, "temperature": 0.1, "frequency_penalty": 0.1}'::jsonb, 1, 'kor', '2024-07-08 11:22:42.486', '2024-07-08 11:22:42.486', 0.0, 0.0);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(28, 'caf-azure-gpt-4o', 'caf-azure', 'caf-azure-gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(29, 'caf-azure-gpt-4-turbo', 'caf-azure', 'caf-azure-gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(30, 'caf-azure-gpt-4-32k', 'caf-azure', 'caf-azure-gpt-4-32k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.06, 0.12);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(31, 'caf-azure-gpt-35-turbo-16k', 'caf-azure', 'caf-azure-gpt-35-turbo-16k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.004);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(32, 'caf-azure-gpt-35-turbo', 'caf-azure', 'caf-azure-gpt-35-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(33, 'gpt-4o', 'openai', 'gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(34, 'gpt-4', 'openai', 'gpt-4', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.03, 0.06);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(35, 'gpt-4-turbo', 'openai', 'gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(36, 'gpt-3.5-turbo', 'openai', 'gpt-3.5-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 0, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(37, 'azure-gpt-4o', 'azure', 'azure-gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(38, 'azure-gpt-4-turbo', 'azure', 'azure-gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(39, 'azure-gpt-4-32k', 'azure', 'azure-gpt-4-32k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.06, 0.12);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(40, 'azure-gpt-35-turbo-16k', 'azure', 'azure-gpt-35-turbo-16k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.004);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(41, 'azure-gpt-35-turbo', 'azure', 'azure-gpt-35-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(42, 'claude-3-haiku-20240307', 'anthropic', 'claude-3-haiku-20240307', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0025, 0.00125);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(43, 'twcc-ffm-llama3-70b-chat', 'twcc', 'twcc-ffm-llama3-70b-chat', '{"top_p": 1, "max_tokens": 1200, "temperature": 0.1, "frequency_penalty": 0.1}'::jsonb, 1, 'intention', '2024-07-08 11:22:42.486', '2024-07-08 11:22:42.486', 0.0, 0.0);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(44, 'caf-azure-gpt-4o', 'caf-azure', 'caf-azure-gpt-4o', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.005, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(45, 'caf-azure-gpt-4-turbo', 'caf-azure', 'caf-azure-gpt-4-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.01, 0.03);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(46, 'caf-azure-gpt-4-32k', 'caf-azure', 'caf-azure-gpt-4-32k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.06, 0.12);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(47, 'caf-azure-gpt-35-turbo-16k', 'caf-azure', 'caf-azure-gpt-35-turbo-16k', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.004);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(48, 'caf-azure-gpt-35-turbo', 'caf-azure', 'caf-azure-gpt-35-turbo', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0015, 0.002);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(49, 'claude-3-opus-20240229', 'anthropic', 'claude-3-opus-20240229', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.015, 0.075);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(50, 'claude-3-sonnet-20240229', 'anthropic', 'claude-3-sonnet-20240229', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(51, 'claude-3-opus-20240229', 'anthropic', 'claude-3-opus-20240229', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.015, 0.075);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(52, 'claude-3-sonnet-20240229', 'anthropic', 'claude-3-sonnet-20240229', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(53, 'claude-3-opus-20240229', 'anthropic', 'claude-3-opus-20240229', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.015, 0.075);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(54, 'claude-3-sonnet-20240229', 'anthropic', 'claude-3-sonnet-20240229', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(55, 'claude-3-opus-20240229', 'anthropic', 'claude-3-opus-20240229', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.015, 0.075);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(56, 'claude-3-sonnet-20240229', 'anthropic', 'claude-3-sonnet-20240229', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.003, 0.015);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(57, 'gpt-4o-mini', 'openai', 'gpt-4o-mini', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.00015, 0.0006);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(58, 'gpt-4o-mini', 'openai', 'gpt-4o-mini', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.00015, 0.0006);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(59, 'gpt-4o-mini', 'openai', 'gpt-4o-mini', '{"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.00015, 0.0006);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(60, 'whisper-1', 'openai', 'whisper-1', '{}'::jsonb, 1, 'voice', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0, 0.0);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(61, 'csc-whisper-1', 'local', 'whisper-1', '{"base_url":"https://ezoag.csc.com.tw/whisper/v1"}'::jsonb, 1, 'voice', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0, 0.0);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(62, 'csc-meta-llama-8b', 'local', 'meta-llama--Meta-Llama-3.1-8B-Instruct','{"base_url": "https://ezoag.csc.com.tw/llm/v1","top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'search', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0, 0.0);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(63, 'csc-meta-llama-8b', 'local', 'meta-llama--Meta-Llama-3.1-8B-Instruct','{"base_url": "https://ezoag.csc.com.tw/llm/v1","top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'kor', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0, 0.0);
            INSERT INTO public.model_list
            (id, "name", vendor, model_name, config, is_enable, model_type, create_time, update_time, prompt_rate, completion_rate)
            VALUES(64, 'csc-meta-llama-8b', 'local', 'meta-llama--Meta-Llama-3.1-8B-Instruct','{"base_url": "https://ezoag.csc.com.tw/llm/v1","top_p": 1, "max_tokens": 1200, "temperature": 0, "system_prompt": "僅使用提供的文本回答問題，若答案沒有在參考來源中: 1. 直接回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" 2. 不要提供任何其他解釋或猜測。 3. 結束回答。如果問題在提供的參考來源內有答案，請提供該答案，並且不用再回答\\\"不好意思，從參考資料中無法得到問題的答案，您可以換個方式問問看。\\\" ", "frequency_penalty": 0}'::jsonb, 1, 'intention', '2024-06-24 10:04:06.302', '2024-06-24 10:04:06.302', 0.0, 0.0);
            `,
            // `INSERT INTO public.expert
            // (id, "name", welcome, avatar, url, config_jsonb, is_enable, state, "permission", prompt, create_time, update_time)
            // VALUES('5a437597-b9dc-44ac-ab3a-c244bc416847', '高雄市市民小幫手', '歡迎使用', './robot.png', 'DDGbnBc9T2qdHgZv', NULL, 1, 0, 0, NULL, '2024-03-23 10:40:45.710', '2024-03-23 10:40:45.710');
            // `,
            // `INSERT INTO public.datasets
            // (id, "name", "describe", config_jsonb, folder_name, is_enable, state, icon, create_time, update_time)
            // VALUES('c2b59674-ea3e-41cd-8310-2710aba69e57', '高雄市政府1999資料集', 'useful for when you want to answer queries about the 高雄市政府1999資料集', '{"model": "claude-3-haiku-20240307", "examples": [], "intention": "", "model_params": {"top_p": 1, "max_tokens": 1200, "temperature": 0, "frequency_penalty": 0}, "search_kwargs": {"k": 5}, "system_prompt": "", "embedding_model": "text-embedding-3-large", "content_replacement_list": []}'::jsonb, '604c248f-6959-45a6-9852-10dc4a549476', 1, 0, NULL, '2024-03-23 10:40:58.599', '2024-03-23 10:40:58.599');
            // `,
        ];
        let rs = await updatedb(sqlArr);
        for (let r of rs) {
            rsArr.push({ command: r.command, rowCount: r.rowCount, rows: r.rows });
        }
    } catch (err) {
        console.error("導出時發生錯誤：", err.stack);
    }

    return rsArr;
};
module.exports = { js_title, js_program };
