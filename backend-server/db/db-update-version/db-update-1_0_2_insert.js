const sqlArr = [
`INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class")
VALUES('a8d4f28f-2fa5-489c-aecd-510471da7bf2', '會議室預約', '2023-12-01 13:02:41.302', 'start using your api 會議室預約', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-01 13:02:41.302', 'ResourceBooker');
`,
`INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class")
VALUES('1486b74a-fea3-49c5-a8f3-911354c5b0e4', '請假', '2023-12-01 13:03:52.678', 'start using your api 請假', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-01 13:03:52.678', 'ICSC_hdjjb01A');
`,
`INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class")
VALUES('e41b26f2-498f-4276-a495-e62be7889e0c', '問分機資訊', '2023-12-01 13:04:23.796', 'start using your api 問分機資訊', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-01 13:04:23.796', 'CSCInquirerTelNoByName');
`,
`INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class")
VALUES('020de8af-e340-49a3-8faf-a2a8ae4bf08e', '高鐵班次', '2023-12-01 13:04:41.790', 'start using your api 高鐵班次', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-01 13:04:41.790', 'ThsrTimetableInquirer');
`,
`INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class")
VALUES('515f81b4-14c1-4ac7-be66-cbebe5570d41', '查詢會議室可預約資料', '2023-12-01 13:05:13.198', 'start using your api 查詢會議室可預約資料', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-01 13:05:13.198', 'ResourceInquirer');
`,
`INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class")
VALUES('fb523fad-0075-4ba5-b607-f5139421a9f7', '用分機查人', '2023-12-01 13:05:40.772', 'start using your api 用分機查人', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-01 13:05:40.772', 'CSCInquirerExtensionNum');
`,
`INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class")
VALUES('5dcb8181-ee95-4a80-8686-6332ca3266cc', '加班申請', '2023-12-01 13:06:17.996', 'start using your api 加班申請', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-01 13:06:17.996', 'ICSC_hdjjc05A');
`,
`INSERT INTO public.skill
(id, "name", create_time, "describe", config_jsonb, update_time, "class")
VALUES('de8d636a-55de-4e46-b0af-81b5c03dcb74', '查中鋼部門人員資訊', '2023-12-01 13:06:35.861', 'start using your api 查中鋼部門人員資訊', '{"webapi": {"body": {}, "query": {}, "apiurl": "", "method": "", "params": {}, "headers": {}, "required": [], "response_detail": {}}, "examples": [], "intention": "", "search_kwargs": {"k": 5}, "system_prompt": ""}'::jsonb, '2023-12-01 13:06:35.861', 'CSCFindBossInfoByDept');
`,
];

module.exports = sqlArr;
