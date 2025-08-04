const sqlArr = [
    `INSERT INTO public.expert
    (id, "name", welcome, avatar, url, config_jsonb, create_time, update_time, is_enabe, state)
    VALUES('bdc3588b-dbfb-4b73-98fc-7614770112f3', '管理員', '歡迎使用', './robot.png', 't9aBLuLgzzFhYCHX', NULL, '2023-12-04 15:52:38.526', '2023-12-04 15:52:38.526', 1, 0);`,
];

module.exports = sqlArr;
