const sqlArr = [
    `CREATE TABLE public.crawler_documents_qa_extra (
        id varchar(50) NOT NULL,
        crawler_documents_qa_id varchar(50) NULL,
        datasets_id varchar(50) NOT NULL,
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        qa_data varchar NULL, -- 格式:{question:'',answer:'',show_status:1}¶show_status:使用者是否看的到
        crawler_id varchar(50) NULL,
        crawler_documents_qa_hash varchar(50) NULL, -- null則是新創
        is_enable int2 NOT NULL DEFAULT 1, -- 是否啟用
        CONSTRAINT crawler_documents_qa_extra_pk PRIMARY KEY (id),
        CONSTRAINT crawler_documents_qa_extra_un UNIQUE (crawler_documents_qa_id)
        
    );`,
    `ALTER TABLE public.crawler_documents_qa_extra ADD CONSTRAINT crawler_documents_qa_extra_fk FOREIGN KEY (datasets_id) REFERENCES public.datasets(id);
    ALTER TABLE public.crawler_documents_qa_extra ADD CONSTRAINT crawler_documents_qa_extra_fk_1 FOREIGN KEY (crawler_documents_qa_id) REFERENCES public.crawler_documents_qa(id);`,
    `COMMENT ON COLUMN public.crawler_documents_qa_extra.crawler_documents_qa_id IS 'null則是新創';
    COMMENT ON COLUMN public.crawler_documents_qa_extra.qa_data IS '格式:{question:'''',answer:'''',show_status:1}`,
    `COMMENT ON COLUMN public.upload_documents.training_state IS '訓練狀態
    0:上傳失敗
    1:上傳成功
    2:建索引中
    3:建立成功
    4:禁用
    5:已刪除
    99:檔案毀損';`,
    `ALTER TABLE public.upload_documents ADD datasource_url varchar(255) NULL;`,
    `ALTER TABLE public.upload_documents ADD datasource_name varchar(50) NULL;`,
    // `ALTER TABLE public.bot_messages RENAME TO "group";`,
];
module.exports = sqlArr;
