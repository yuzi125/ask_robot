const sqlArr = [
    `ALTER TABLE public.model_token_log RENAME COLUMN gpt_model TO model;`,
    `CREATE TABLE public.embedding_token_log (
        id bigserial NOT NULL,  -- embedding id
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, 
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        model varchar(50) NOT NULL, -- embedding model name
        prompt_token int4 NOT NULL, -- embedding prompt token
        datasets_id varchar(50) NOT NULL, 
        prompt_rate float8 NOT NULL,
        price_usd float8 NOT NULL,
        CONSTRAINT embedding_token_log_pk PRIMARY KEY (id)
    );`,
    `ALTER TABLE public.embedding_token_log ADD CONSTRAINT embedding_token_log_fk FOREIGN KEY (datasets_id) REFERENCES public.datasets(id);`,
    `ALTER TABLE public.expert ADD prompt varchar(5000) NULL;`,
    `ALTER TABLE public.datasource ADD is_enable int2 NOT NULL DEFAULT 0;`,
    `COMMENT ON COLUMN public.datasource.is_enable IS '0:禁用 1:啟用';`,
    // `ALTER TABLE public.bot_messages RENAME TO "group";`,
];
module.exports = sqlArr;
