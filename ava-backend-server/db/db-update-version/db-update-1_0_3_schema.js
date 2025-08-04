const sqlArr = [
    `ALTER TABLE public.skill ADD is_enable int4 NOT NULL DEFAULT 1;`,
    `ALTER TABLE public.skill ADD state int4 NOT NULL DEFAULT 0;`,
    `ALTER TABLE public.datasets ADD is_enable int4 NOT NULL DEFAULT 1;`,
    `ALTER TABLE public.datasets ADD state int4 NOT NULL DEFAULT 0;`,
    `ALTER TABLE public.expert ADD is_enabe int4 NOT NULL DEFAULT 1;`,
    `ALTER TABLE public.expert ADD state int4 NOT NULL DEFAULT 0;`,
    `ALTER TABLE public.recommend_history ADD expert_id varchar(50) NOT NULL;`,
    `ALTER TABLE public.recommend_history ADD CONSTRAINT recommend_history_fk1 FOREIGN KEY (expert_id) REFERENCES expert(id) ON DELETE CASCADE;`,
    `ALTER TABLE public.recommend_preset ADD expert_id varchar(50) NOT NULL;`,
    `ALTER TABLE public.recommend_preset ADD CONSTRAINT recommend_preset_fk FOREIGN KEY (expert_id) REFERENCES expert(id) ON DELETE CASCADE;`,
    `ALTER TABLE public.recommend_preset DROP CONSTRAINT recommend_preset_pk;`,
    `ALTER TABLE public.recommend_preset ADD CONSTRAINT recommend_preset_pk PRIMARY KEY (id,expert_id);`,
];

module.exports = sqlArr;
