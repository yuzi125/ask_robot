const sqlArr = [
    `CREATE TABLE public.skill (
        id varchar(50) NOT NULL,
        "name" varchar(50) NOT NULL,
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "describe" varchar(1000) NULL,
        config_jsonb jsonb NULL,
        update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "class" varchar(50) NOT NULL,
        CONSTRAINT skill_pk PRIMARY KEY (id),
        CONSTRAINT skill_un UNIQUE (class)
    );`,
    `CREATE TABLE public.expert_skill_mapping (
        expert_id varchar(50) NOT NULL,
        skill_id varchar(50) NOT NULL,
        create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT expert_skill_mapping_pk PRIMARY KEY (expert_id, skill_id)
    );`,
    `ALTER TABLE public.expert_skill_mapping ADD CONSTRAINT expert_skill_mapping_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE;`,
    `ALTER TABLE public.expert_skill_mapping ADD CONSTRAINT expert_skill_mapping_fk_1 FOREIGN KEY (skill_id) REFERENCES public.skill(id) ON DELETE CASCADE;`,
];

module.exports = sqlArr;
