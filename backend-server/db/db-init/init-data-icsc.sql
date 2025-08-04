INSERT INTO public.user_login_type(type_name) VALUES('遊客登入');
INSERT INTO public.user_login_type(type_name) VALUES('中鋼sso');

INSERT INTO public.users (id,user_type_id) VALUES('3b78c6be-3769-43a7-be1a-f01e9f79a80c',1);

INSERT INTO public.user_info_type(type_name) VALUES('工號');
INSERT INTO public.user_info_type(type_name) VALUES('名稱');
INSERT INTO public.user_info_type(type_name) VALUES('頭像');
INSERT INTO public.user_info_type(type_name) VALUES('職稱');
INSERT INTO public.user_info_type(type_name) VALUES('信箱');
INSERT INTO public.user_info_type(type_name) VALUES('公司');
INSERT INTO public.user_info_type(type_name) VALUES('部門');
INSERT INTO public.user_info_type(type_name) VALUES('性別');
INSERT INTO public.user_info_type(type_name) VALUES('生日');
INSERT INTO public.user_info_type(type_name) VALUES('帳號類別');

INSERT INTO public.user_info(user_id,info_type_id,value) VALUES('3b78c6be-3769-43a7-be1a-f01e9f79a80c',2,'jeason');
INSERT INTO public.user_info(user_id,info_type_id,value) VALUES('3b78c6be-3769-43a7-be1a-f01e9f79a80c',3,'./robot.png');
INSERT INTO public.user_info(user_id,info_type_id,value) VALUES('3b78c6be-3769-43a7-be1a-f01e9f79a80c',8,'1');

INSERT INTO public.settings
("key", value)
VALUES('system_bulletin', '');
INSERT INTO public.settings
("key", value)
VALUES('system_bulletin_color', '');
INSERT INTO public.settings
("key", value)
VALUES('system_bulletin_color_back', '');


INSERT INTO public.expert
(id, "name", welcome, avatar, url)
VALUES('a58d56db-2fda-4520-b4cf-7a272a4a1a62', 'AVA', '歡迎使用Ava，您的智慧特助', './robot.png', '1sP3MiL5D4Y0TzRC');
INSERT INTO public.expert
(id, "name", welcome, avatar, url)
VALUES('4373cbe5-41b0-4dba-bb75-a413fc887140', 'ERP專家', '歡迎使用ERP專家', './robot.png', 'vR1AnoG0clzKbu2H');

INSERT INTO public.expert
(id, "name", welcome, avatar, url, config_jsonb, create_time, update_time, is_enable, state)
VALUES('bdc3588b-dbfb-4b73-98fc-7614770112f3', '管理員', '歡迎使用', './robot.png', 't9aBLuLgzzFhYCHX', NULL, '2023-12-04 15:52:38.526', '2023-12-04 15:52:38.526', 1, 0);


INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class", is_enable, state, icon)
VALUES('78c1bd0f-843b-4e58-af7c-afdd41f68d61', '出差申請', '2023-12-17 12:35:25.110', 'start using your api 出差申請', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-17 12:35:25.110', '_ERPWebApiRunner_hdjj602A', 1, 0, NULL);
INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class", is_enable, state, icon)
VALUES('5a6ea7d3-eeb5-45e4-a357-0573af7aa24b', '個人通訊資料查詢', '2023-12-16 19:11:26.702', 'start using your api 個人通訊資料查詢', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-16 19:11:26.702', '_ERPWebApiRunner_hajj115Main', 1, 0, NULL);
INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class", is_enable, state, icon)
VALUES('209e26f5-1a1c-412b-93c7-04a9edd370c0', '超時工作申報', '2023-12-09 13:26:47.517', 'start using your api 超時工作申請', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-09 13:26:47.517', '_ERPWebApiRunner_hdjjc01', 1, 0, NULL);

INSERT INTO public.datasource_type
(id, mark, "name")
VALUES('A', '手動上傳', 'upload');
INSERT INTO public.datasource_type
(id, mark, "name")
VALUES('B', '爬蟲', 'crawler');