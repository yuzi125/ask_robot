const sqlArr = [
    `ALTER TABLE public.model_token_log RENAME COLUMN output_token TO completion_token;
    COMMENT ON COLUMN public.model_token_log.classify IS 'intent/streaming';
    COMMENT ON COLUMN public.model_token_log.model IS 'gpt-3.5-turbo';
    COMMENT ON COLUMN public.model_token_log.category IS 'appId';
    COMMENT ON COLUMN public.model_token_log.id IS '自增id';`,
    `ALTER TABLE public.model_token_log RENAME COLUMN output_rate TO completion_rate;`,
    `ALTER TABLE public.model_token_log RENAME COLUMN expert_model_id TO expert_model;`,
    `COMMENT ON COLUMN public.model_token_log.expert_model_id IS '知識庫folder_name或技能class';`,
    `COMMENT ON COLUMN public.model_token_log.expert_model_type IS '0:意圖 1:知識庫 2:技能';`,
    `ALTER TABLE public.model_token_log DROP COLUMN category;`,
    `COMMENT ON COLUMN public.model_token_log.expert_model_type IS '0:意圖
    1:知識庫
    2:技能
    3:方法';`,
    `ALTER TABLE public.skill DROP CONSTRAINT skill_un;`,
    `ALTER TABLE public.expert ADD "permission" smallint NOT NULL DEFAULT 0;`,
    `COMMENT ON COLUMN public.expert."permission" IS '0:須查看user權限
    1:公開';`,
    `CREATE TABLE public.expert_users_mapping (
        expert_id varchar(50) NOT NULL, -- 專家id
        users_uid varchar(50) NOT NULL, -- 使用者uid
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT expert_users_mapping_pk PRIMARY KEY (expert_id, users_uid)
    );
    COMMENT ON COLUMN public.expert_users_mapping.expert_id IS '專家id';
    COMMENT ON COLUMN public.expert_users_mapping.users_uid IS '使用者uid';
    ALTER TABLE public.expert_users_mapping ADD CONSTRAINT expert_users_mapping_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE;
    ALTER TABLE public.expert_users_mapping ADD CONSTRAINT expert_users_mapping_fk_1 FOREIGN KEY (users_uid) REFERENCES public.users(uid) ON DELETE CASCADE;`,
];

module.exports = sqlArr;
