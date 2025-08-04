const sqlArr = [
    `COMMENT ON COLUMN public.datasets.is_enable IS '0:禁用1:啟用';`,
    `ALTER TABLE public.datasets ADD datasource jsonb NULL;`,
    `COMMENT ON COLUMN public.datasets.datasource IS '格式:[0,1,2]
0:Upload
1:SyncWeb
2:SyncFileServer
3:Webapi';`,
    `CREATE TABLE public.crawler (
        id varchar(50) NOT NULL, -- 爬蟲id
        config_jsonb jsonb NULL, -- 設定json
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT crawler_pk PRIMARY KEY (id)
    );`,
    `COMMENT ON TABLE public.crawler IS '爬蟲';
    COMMENT ON COLUMN public.crawler.id IS '爬蟲id';
    COMMENT ON COLUMN public.crawler.config_jsonb IS '設定json';`,
    `CREATE TABLE public.documents_qa (
        id varchar(50) NOT NULL,
        question_original varchar NULL, -- 原本的問題
        answer_original varchar NULL, -- 原本的答案
        adorn_original varchar NULL, -- 原本的答案修飾後
        question varchar NULL, -- 問題
        answer varchar NULL, -- 答案
        adorn varchar NULL, -- 修飾過的答案
        documents_id varchar(50) NOT NULL, -- 關聯爬蟲文件
        info jsonb NULL, -- 網站本身如果有qa的id
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT documents_qa_pk PRIMARY KEY (id)
    );`,
    `COMMENT ON TABLE public.documents_qa IS '爬到的文件QA';`,
    `COMMENT ON COLUMN public.documents_qa.question_original IS '原本的問題';
    COMMENT ON COLUMN public.documents_qa.answer_original IS '原本的答案';
    COMMENT ON COLUMN public.documents_qa.adorn_original IS '原本的答案修飾後';
    COMMENT ON COLUMN public.documents_qa.question IS '問題';
    COMMENT ON COLUMN public.documents_qa.answer IS '答案';
    COMMENT ON COLUMN public.documents_qa.adorn IS '修飾過的答案';
    COMMENT ON COLUMN public.documents_qa.documents_id IS '關聯爬蟲文件';
    COMMENT ON COLUMN public.documents_qa.info IS '網站本身如果有qa的id';`,
    `ALTER TABLE public.documents_qa ADD CONSTRAINT documents_qa_fk FOREIGN KEY (documents_id) REFERENCES public.documents(id) ON DELETE SET NULL;`,
    `CREATE TABLE public.synchronize (
        id bigserial NOT NULL, -- 自增id
        state int2 NOT NULL DEFAULT 0, -- 0:失敗 1:成功
        config_jsonb jsonb NULL,
        "type" int2 NOT NULL DEFAULT 0, -- 0:爬蟲 1:FileServer
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        datasets_id varchar(50) NOT NULL, -- 資料集id
        datasource_id varchar(50) NOT NULL -- 根據type用程式關聯主表
    );`,
    `COMMENT ON TABLE public.synchronize IS '同步表';
    COMMENT ON COLUMN public.synchronize.id IS '自增id';
    COMMENT ON COLUMN public.synchronize.state IS '0:失敗 1:成功';
    COMMENT ON COLUMN public.synchronize."type" IS '0:爬蟲 1:FileServer';
    COMMENT ON COLUMN public.synchronize.datasets_id IS '資料集id';
    COMMENT ON COLUMN public.synchronize.datasource_id IS '根據type用程式關聯主表';`,
    `CREATE TABLE public.history_messages (
        "input" varchar NULL, -- 剛輸入時
        "output" varchar NULL, -- 返回給使用者時
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        users_uid varchar(50) NULL, -- 使用者uid
        expert_id varchar(50) NULL, -- 專家id
        "type" jsonb NULL -- 經過哪些model
    );`,
    `COMMENT ON TABLE public.history_messages IS '單純記錄初始輸入與回傳輸出方便統計';
    COMMENT ON COLUMN public.history_messages."input" IS '剛輸入時';
    COMMENT ON COLUMN public.history_messages."output" IS '返回給使用者時';
    COMMENT ON COLUMN public.history_messages.users_uid IS '使用者uid';
    COMMENT ON COLUMN public.history_messages.expert_id IS '專家id';
    COMMENT ON COLUMN public.history_messages."type" IS '經過哪些model';`,
    `ALTER TABLE public.datasets ALTER COLUMN folder_name TYPE varchar(50) USING folder_name::varchar;`,
    `ALTER TABLE public.documents ADD "type" smallint NOT NULL DEFAULT 0;`,
    `ALTER TABLE public.crawler ADD is_show smallint NOT NULL DEFAULT 1;
    COMMENT ON COLUMN public.crawler.is_show IS '是否顯示在後台';`,
    `ALTER TABLE public.documents_qa ADD is_enable smallint NOT NULL DEFAULT 1;
    COMMENT ON COLUMN public.documents_qa.is_enable IS '是否啟用';`,
];

module.exports = sqlArr;
