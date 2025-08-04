const sqlArr = [
    `CREATE TABLE public.model_token_log (
        id bigserial NOT NULL,
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        users_uid varchar(50) NULL,
        model varchar(50) NOT NULL,
        classify varchar(50) NOT NULL, -- gpt-3.5-turbo
        category int4 NOT NULL, -- 5
        prompt_token int4 NOT NULL, -- 輸入token數
        output_token int4 NOT NULL, -- 輸出token數
        user_input varchar NOT NULL, -- 使用者輸入
        expert_id varchar(50) NULL, -- 專家id
        expert_model_id varchar(50) NULL, -- 知識庫或技能id
        expert_model_type int2 NOT NULL, -- 0:知識庫 1:技能
        prompt_rate float8 NOT NULL, -- 輸入token比率
        output_rate float8 NOT NULL, -- 輸出token比率
        price_usd float8 NOT NULL, -- 比率換算後金額
        chat_uuid varchar(50) NOT NULL -- 判斷同筆聊天用
    );
    COMMENT ON COLUMN public.model_token_log.classify IS 'gpt-3.5-turbo';
    COMMENT ON COLUMN public.model_token_log.category IS '5';
    COMMENT ON COLUMN public.model_token_log.prompt_token IS '輸入token數';
    COMMENT ON COLUMN public.model_token_log.output_token IS '輸出token數';
    COMMENT ON COLUMN public.model_token_log.user_input IS '使用者輸入';
    COMMENT ON COLUMN public.model_token_log.expert_id IS '專家id';
    COMMENT ON COLUMN public.model_token_log.expert_model_id IS '知識庫或技能id';
    COMMENT ON COLUMN public.model_token_log.expert_model_type IS '0:知識庫 1:技能';
    COMMENT ON COLUMN public.model_token_log.prompt_rate IS '輸入token比率';
    COMMENT ON COLUMN public.model_token_log.output_rate IS '輸出token比率';
    COMMENT ON COLUMN public.model_token_log.price_usd IS '比率換算後金額';
    COMMENT ON COLUMN public.model_token_log.chat_uuid IS '判斷同筆聊天用';

    ALTER TABLE public.model_token_log ADD CONSTRAINT model_token_log_fk FOREIGN KEY (users_uid) REFERENCES public.users(uid) ON DELETE SET NULL;
    ALTER TABLE public.model_token_log ADD CONSTRAINT model_token_log_fk1 FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE SET NULL;`,
];

module.exports = sqlArr;
