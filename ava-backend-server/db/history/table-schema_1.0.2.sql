CREATE TABLE public.datasets (
	id varchar(50) NOT NULL, -- 知識庫id
	"name" varchar(50) NOT NULL, -- 知識庫名稱
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 建立時間
	"describe" varchar(1000) NULL, -- 描述
	config_jsonb jsonb NULL,
	folder_name varchar(50) NOT NULL,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT datasets_pk PRIMARY KEY (id),
	CONSTRAINT datasets_un UNIQUE (folder_name)
);

CREATE TABLE public.documents (
	id varchar(50) NOT NULL,
	datasets_id varchar(50) NOT NULL,
	filename varchar(50) NOT NULL, -- 存檔名
	originalname varchar(50) NOT NULL, -- 原始名
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	is_enable int4 NOT NULL DEFAULT 1, -- 是否啟用
	training_state int4 NOT NULL DEFAULT 0, -- 訓練狀態¶0:上傳失敗¶1:上傳成功¶2:建索引中¶3:建立成功
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT documents_pk PRIMARY KEY (id),
	CONSTRAINT documents_fk FOREIGN KEY (datasets_id) REFERENCES public.datasets(id) ON DELETE CASCADE
);
CREATE INDEX documents_datasets_id_idx ON public.documents USING btree (datasets_id);
CREATE UNIQUE INDEX documents_id_idx ON public.documents USING btree (id);


CREATE TABLE public.settings (
	"key" varchar(50) NOT NULL,
	value varchar(500) NULL,
	CONSTRAINT settings_pk PRIMARY KEY (key)
);

CREATE TABLE public.expert (
	id varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	welcome varchar(255) NULL,
	avatar varchar(1000) NULL,
	url varchar(50) NULL,
	config_jsonb jsonb NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT expert_pk PRIMARY KEY (id)
);

ALTER TABLE public.bot_messages ADD CONSTRAINT bot_messages_expert_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id);


CREATE TABLE public.expert_datasets_mapping (
	expert_id varchar(50) NOT NULL,
	datasets_id varchar(50) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT expert_datasets_mapping_pk PRIMARY KEY (expert_id, datasets_id),
	CONSTRAINT expert_datasets_mapping_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE,
	CONSTRAINT expert_datasets_mapping_fk_1 FOREIGN KEY (datasets_id) REFERENCES public.datasets(id) ON DELETE CASCADE
);