-- public.crawler definition

-- Drop table

-- DROP TABLE public.crawler;

CREATE TABLE public.crawler (
	id varchar(50) NOT NULL, -- 爬蟲id
	config_jsonb jsonb NOT NULL, -- 設定json
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	is_show int2 NOT NULL DEFAULT 1, -- 是否顯示在後台
	"domain" varchar(1000) NULL, -- 域名
	title varchar(255) NOT NULL DEFAULT 1, -- 站名
	CONSTRAINT crawler_pk PRIMARY KEY (id)
);
COMMENT ON TABLE public.crawler IS '爬蟲';

-- Column comments

COMMENT ON COLUMN public.crawler.id IS '爬蟲id';
COMMENT ON COLUMN public.crawler.config_jsonb IS '設定json';
COMMENT ON COLUMN public.crawler.is_show IS '是否顯示在後台';
COMMENT ON COLUMN public.crawler."domain" IS '域名';
COMMENT ON COLUMN public.crawler.title IS '站名';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.crawler for each row execute function update_timestamp();


-- public.datasets definition

-- Drop table

-- DROP TABLE public.datasets;

CREATE TABLE public.datasets (
	id varchar(50) NOT NULL, -- 數據集id
	"name" varchar(50) NOT NULL, -- 數據集名稱
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 建立時間
	"describe" varchar(1000) NULL, -- 描述
	config_jsonb jsonb NULL, -- prompt設定
	folder_name varchar(50) NOT NULL, -- 不可改資料夾名稱
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新時間
	is_enable int4 NOT NULL DEFAULT 1, -- 0:禁用1:啟用
	state int4 NOT NULL DEFAULT 0,
	icon varchar(1000) NULL,
	CONSTRAINT datasets_pk PRIMARY KEY (id),
	CONSTRAINT datasets_un UNIQUE (folder_name)
);
COMMENT ON TABLE public.datasets IS '資料集';

-- Column comments

COMMENT ON COLUMN public.datasets.id IS '數據集id';
COMMENT ON COLUMN public.datasets."name" IS '數據集名稱';
COMMENT ON COLUMN public.datasets.create_time IS '建立時間';
COMMENT ON COLUMN public.datasets."describe" IS '描述';
COMMENT ON COLUMN public.datasets.config_jsonb IS 'prompt設定';
COMMENT ON COLUMN public.datasets.folder_name IS '不可改資料夾名稱';
COMMENT ON COLUMN public.datasets.update_time IS '更新時間';
COMMENT ON COLUMN public.datasets.is_enable IS '0:禁用1:啟用';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.datasets for each row execute function update_timestamp();


-- public.datasource_type definition

-- Drop table

-- DROP TABLE public.datasource_type;

CREATE TABLE public.datasource_type (
	id varchar(2) NOT NULL, -- 來源id
	mark varchar(50) NULL, -- 來源名稱
	"name" varchar(50) NULL, -- 主表名
	CONSTRAINT datasource_type_pk PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN public.datasource_type.id IS '來源id';
COMMENT ON COLUMN public.datasource_type.mark IS '來源名稱';
COMMENT ON COLUMN public.datasource_type."name" IS '主表名';


-- public.expert definition

-- Drop table

-- DROP TABLE public.expert;

CREATE TABLE public.expert (
	id varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL, -- 專家名稱
	welcome varchar(255) NULL, -- 歡迎詞
	avatar varchar(1000) NULL, -- 頭像
	url varchar(50) NULL, -- 專家url
	config_jsonb jsonb NULL, -- prompt設定
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	is_enable int4 NOT NULL DEFAULT 1,
	state int4 NOT NULL DEFAULT 0,
	"permission" int2 NOT NULL DEFAULT 0, -- 0:須查看user權限¶    1:公開
	prompt varchar(5000) NULL,
	CONSTRAINT expert_pk PRIMARY KEY (id)
);
COMMENT ON TABLE public.expert IS '專家表';

-- Column comments

COMMENT ON COLUMN public.expert."name" IS '專家名稱';
COMMENT ON COLUMN public.expert.welcome IS '歡迎詞';
COMMENT ON COLUMN public.expert.avatar IS '頭像';
COMMENT ON COLUMN public.expert.url IS '專家url';
COMMENT ON COLUMN public.expert.config_jsonb IS 'prompt設定';
COMMENT ON COLUMN public.expert."permission" IS '0:須查看user權限
    1:公開';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.expert for each row execute function update_timestamp();


-- public.group_history definition

-- Drop table

-- DROP TABLE public.group_history;

CREATE TABLE public.group_history (
	id varchar(50) NOT NULL,
	group_id varchar(50) NOT NULL,
	from_uid varchar(50) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- public.group_type definition

-- Drop table

-- DROP TABLE public.group_type;

CREATE TABLE public.group_type (
	id varchar(50) NOT NULL,
	"name" varchar(255) NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- public.group_user definition

-- Drop table

-- DROP TABLE public.group_user;

CREATE TABLE public.group_user (
	id varchar(50) NOT NULL,
	group_id varchar(50) NOT NULL,
	users_id varchar(50) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- public.history_messages definition

-- Drop table

-- DROP TABLE public.history_messages;

CREATE TABLE public.history_messages (
	"input" varchar NULL, -- 剛輸入時
	"output" varchar NULL, -- 返回給使用者時
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	users_id varchar(50) NULL, -- 使用者uid
	expert_id varchar(50) NULL, -- 專家id
	"type" jsonb NULL -- 經過哪些model
);
COMMENT ON TABLE public.history_messages IS '單純記錄初始輸入與回傳輸出方便統計';

-- Column comments

COMMENT ON COLUMN public.history_messages."input" IS '剛輸入時';
COMMENT ON COLUMN public.history_messages."output" IS '返回給使用者時';
COMMENT ON COLUMN public.history_messages.users_id IS '使用者uid';
COMMENT ON COLUMN public.history_messages.expert_id IS '專家id';
COMMENT ON COLUMN public.history_messages."type" IS '經過哪些model';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.history_messages for each row execute function update_timestamp();


-- public.message definition

-- Drop table

-- DROP TABLE public.message;

CREATE TABLE public.message (
	id varchar(50) NOT NULL,
	group_history_id varchar(50) NOT NULL,
	message_type_id varchar(50) NOT NULL,
	"content" jsonb NULL
);


-- public.message_type definition

-- Drop table

-- DROP TABLE public.message_type;

CREATE TABLE public.message_type (
	id varchar(50) NOT NULL,
	"name" varchar(50) NULL
);


-- public.settings definition

-- Drop table

-- DROP TABLE public.settings;

CREATE TABLE public.settings (
	"key" varchar(50) NOT NULL,
	value TEXT NULL,
	CONSTRAINT settings_pk PRIMARY KEY (key)
);
COMMENT ON TABLE public.settings IS '各種系統設定';


-- public.skill definition

-- Drop table

-- DROP TABLE public.skill;

CREATE TABLE public.skill (
	id varchar(50) NOT NULL,
	"name" varchar(50) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"describe" varchar(1000) NULL,
	config_jsonb jsonb NULL,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"class" varchar(255) NOT NULL,
	is_enable int4 NOT NULL DEFAULT 1,
	state int4 NOT NULL DEFAULT 0,
	icon varchar(1000) NULL,
	CONSTRAINT skill_pk PRIMARY KEY (id)
);

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.skill for each row execute function update_timestamp();


-- public.users definition

-- Drop table

-- DROP TABLE public.users;

CREATE TABLE public.users (
	id varchar(50) NOT NULL, -- 使用者id
	nickname varchar(50) NOT NULL, -- 暱稱
	avatar varchar(1000) NULL, -- 頭像
	user_no varchar(50) NULL, -- 工號
	post_no varchar(50) NULL, -- 職稱
	dep_no varchar(50) NULL, -- 部門
	id_type varchar(50) NULL, -- 帳號類別
	comp_no varchar(50) NULL, -- 公司
	e_mail varchar(100) NULL,
	sex varchar(50) NULL, -- 性別
	birthday varchar(50) NULL, -- 生日
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	user_info jsonb NULL, -- 原始session資訊
	CONSTRAINT user_pk PRIMARY KEY (id),
	CONSTRAINT users_un UNIQUE (user_no)
);
COMMENT ON TABLE public.users IS '使用者';

-- Column comments

COMMENT ON COLUMN public.users.id IS '使用者id';
COMMENT ON COLUMN public.users.nickname IS '暱稱';
COMMENT ON COLUMN public.users.avatar IS '頭像';
COMMENT ON COLUMN public.users.user_no IS '工號';
COMMENT ON COLUMN public.users.post_no IS '職稱';
COMMENT ON COLUMN public.users.dep_no IS '部門';
COMMENT ON COLUMN public.users.id_type IS '帳號類別';
COMMENT ON COLUMN public.users.comp_no IS '公司';
COMMENT ON COLUMN public.users.sex IS '性別';
COMMENT ON COLUMN public.users.birthday IS '生日';
COMMENT ON COLUMN public.users.user_info IS '原始session資訊';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.users for each row execute function update_timestamp();


-- public.bot_messages definition

-- Drop table

-- DROP TABLE public.bot_messages;

CREATE TABLE public.bot_messages (
	group_id varchar(50) NOT NULL, -- 房間id
	users_id varchar(50) NOT NULL, -- 使用者id
	subject varchar(50) NOT NULL, -- 主題
	chat jsonb NOT NULL, -- 聊天內容
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 建立時間
	context jsonb NULL, -- 上下文
	expert_id varchar(50) NOT NULL, -- 專家id
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新時間
	CONSTRAINT bot_messages_pk PRIMARY KEY (group_id),
	CONSTRAINT bot_messages_un UNIQUE (users_id, expert_id),
	CONSTRAINT bot_messages_expert_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id),
	CONSTRAINT bot_messages_fk FOREIGN KEY (users_id) REFERENCES public.users(id)
);
COMMENT ON TABLE public.bot_messages IS '機器人聊天室';

-- Column comments

COMMENT ON COLUMN public.bot_messages.group_id IS '房間id';
COMMENT ON COLUMN public.bot_messages.users_id IS '使用者id';
COMMENT ON COLUMN public.bot_messages.subject IS '主題';
COMMENT ON COLUMN public.bot_messages.chat IS '聊天內容';
COMMENT ON COLUMN public.bot_messages.create_time IS '建立時間';
COMMENT ON COLUMN public.bot_messages.context IS '上下文';
COMMENT ON COLUMN public.bot_messages.expert_id IS '專家id';
COMMENT ON COLUMN public.bot_messages.update_time IS '更新時間';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.bot_messages for each row execute function update_timestamp();


-- public.datasource definition

-- Drop table

-- DROP TABLE public.datasource;

CREATE TABLE public.datasource (
	id varchar(50) NOT NULL,
	datasets_id varchar(50) NOT NULL,
	config_jsonb jsonb NULL,
	"type" varchar(2) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	is_enable int2 NOT NULL DEFAULT 0, -- 0:禁用 1:啟用
	CONSTRAINT datasource_pk PRIMARY KEY (id),
	CONSTRAINT datasource_un UNIQUE (datasets_id, type),
	CONSTRAINT datasource_fk FOREIGN KEY ("type") REFERENCES public.datasource_type(id),
	CONSTRAINT datasource_fk1 FOREIGN KEY (datasets_id) REFERENCES public.datasets(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.datasource IS '數據源';

-- Column comments

COMMENT ON COLUMN public.datasource.is_enable IS '0:禁用 1:啟用';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.datasource for each row execute function update_timestamp();


-- public.documents definition

-- Drop table

-- DROP TABLE public.documents;

CREATE TABLE public.documents (
	id varchar(50) NOT NULL,
	datasets_id varchar(50) NOT NULL, -- 資料集id
	filename varchar(255) NOT NULL, -- 存檔名
	originalname varchar(255) NOT NULL, -- 原始名
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	is_enable int4 NOT NULL DEFAULT 1, -- 是否啟用
	training_state int4 NOT NULL DEFAULT 0, -- 訓練狀態¶0:上傳失敗¶1:上傳成功¶2:建索引中¶3:建立成功¶4:檔案毀損
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"type" int2 NOT NULL DEFAULT 0, -- 0:Upload,1:Web(Q&A)
	CONSTRAINT documents_pk PRIMARY KEY (id),
	CONSTRAINT documents_fk FOREIGN KEY (datasets_id) REFERENCES public.datasets(id) ON DELETE CASCADE
);
CREATE INDEX documents_datasets_id_idx ON public.documents USING btree (datasets_id);
CREATE UNIQUE INDEX documents_id_idx ON public.documents USING btree (id);
COMMENT ON TABLE public.documents IS '資料集檔案';

-- Column comments

COMMENT ON COLUMN public.documents.datasets_id IS '資料集id';
COMMENT ON COLUMN public.documents.filename IS '存檔名';
COMMENT ON COLUMN public.documents.originalname IS '原始名';
COMMENT ON COLUMN public.documents.is_enable IS '是否啟用';
COMMENT ON COLUMN public.documents.training_state IS '訓練狀態
0:上傳失敗
1:上傳成功
2:建索引中
3:建立成功
4:檔案毀損';
COMMENT ON COLUMN public.documents."type" IS '0:Upload,1:Web(Q&A)';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.documents for each row execute function update_timestamp();


-- public.embedding_token_log definition

-- Drop table

-- DROP TABLE public.embedding_token_log;

CREATE TABLE public.embedding_token_log (
	id bigserial NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	model varchar(50) NOT NULL,
	prompt_token int4 NOT NULL,
	datasets_id varchar(50) NOT NULL,
	prompt_rate float8 NOT NULL,
	price_usd float8 NOT NULL,
	CONSTRAINT embedding_token_log_pk PRIMARY KEY (id),
	CONSTRAINT embedding_token_log_fk FOREIGN KEY (datasets_id) REFERENCES public.datasets(id)
);


-- public.expert_datasets_mapping definition

-- Drop table

-- DROP TABLE public.expert_datasets_mapping;

CREATE TABLE public.expert_datasets_mapping (
	expert_id varchar(50) NOT NULL, -- 專家id
	datasets_id varchar(50) NOT NULL, -- 資料集id
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT expert_datasets_mapping_pk PRIMARY KEY (expert_id, datasets_id),
	CONSTRAINT expert_datasets_mapping_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE,
	CONSTRAINT expert_datasets_mapping_fk_1 FOREIGN KEY (datasets_id) REFERENCES public.datasets(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.expert_datasets_mapping IS '專家與資料集映射表';

-- Column comments

COMMENT ON COLUMN public.expert_datasets_mapping.expert_id IS '專家id';
COMMENT ON COLUMN public.expert_datasets_mapping.datasets_id IS '資料集id';


-- public.expert_skill_mapping definition

-- Drop table

-- DROP TABLE public.expert_skill_mapping;

CREATE TABLE public.expert_skill_mapping (
	expert_id varchar(50) NOT NULL,
	skill_id varchar(50) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT expert_skill_mapping_pk PRIMARY KEY (expert_id, skill_id),
	CONSTRAINT expert_skill_mapping_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE,
	CONSTRAINT expert_skill_mapping_fk_1 FOREIGN KEY (skill_id) REFERENCES public.skill(id) ON DELETE CASCADE
);


-- public.expert_users_mapping definition

-- Drop table

-- DROP TABLE public.expert_users_mapping;

CREATE TABLE public.expert_users_mapping (
	expert_id varchar(50) NOT NULL, -- 專家id
	users_id varchar(50) NOT NULL, -- 使用者uid
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT expert_users_mapping_pk PRIMARY KEY (expert_id, users_id),
	CONSTRAINT expert_users_mapping_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE,
	CONSTRAINT expert_users_mapping_fk_1 FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Column comments

COMMENT ON COLUMN public.expert_users_mapping.expert_id IS '專家id';
COMMENT ON COLUMN public.expert_users_mapping.users_id IS '使用者uid';


-- public.model_token_log definition

-- Drop table

-- DROP TABLE public.model_token_log;

CREATE TABLE public.model_token_log (
	id bigserial NOT NULL, -- 自增id
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	users_id varchar(50) NULL,
	model varchar(50) NOT NULL, -- gpt-3.5-turbo
	classify varchar(50) NOT NULL, -- intent/streaming
	prompt_token int4 NOT NULL, -- 輸入token數
	completion_token int4 NOT NULL, -- 輸出token數
	user_input varchar NOT NULL, -- 使用者輸入
	expert_id varchar(50) NULL, -- 專家id
	expert_model varchar(50) NULL, -- 資料集folder_name或技能class
	expert_model_type int2 NOT NULL, -- 0:意圖¶    1:知識庫¶    2:技能¶    3:方法
	prompt_rate float8 NOT NULL, -- 輸入token比率
	completion_rate float8 NOT NULL, -- 輸出token比率
	price_usd float8 NOT NULL, -- 比率換算後金額
	chat_uuid varchar(50) NOT NULL, -- 判斷同筆聊天用
	CONSTRAINT model_token_log_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE SET NULL,
	CONSTRAINT model_token_log_fk1 FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE SET NULL
);

-- Column comments

COMMENT ON COLUMN public.model_token_log.id IS '自增id';
COMMENT ON COLUMN public.model_token_log.model IS 'gpt-3.5-turbo';
COMMENT ON COLUMN public.model_token_log.classify IS 'intent/streaming';
COMMENT ON COLUMN public.model_token_log.prompt_token IS '輸入token數';
COMMENT ON COLUMN public.model_token_log.completion_token IS '輸出token數';
COMMENT ON COLUMN public.model_token_log.user_input IS '使用者輸入';
COMMENT ON COLUMN public.model_token_log.expert_id IS '專家id';
COMMENT ON COLUMN public.model_token_log.expert_model IS '資料集folder_name或技能class';
COMMENT ON COLUMN public.model_token_log.expert_model_type IS '0:意圖
    1:知識庫
    2:技能
    3:方法';
COMMENT ON COLUMN public.model_token_log.prompt_rate IS '輸入token比率';
COMMENT ON COLUMN public.model_token_log.completion_rate IS '輸出token比率';
COMMENT ON COLUMN public.model_token_log.price_usd IS '比率換算後金額';
COMMENT ON COLUMN public.model_token_log.chat_uuid IS '判斷同筆聊天用';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.model_token_log for each row execute function update_timestamp();


-- public.recommend_custom definition

-- Drop table

-- DROP TABLE public.recommend_custom;

CREATE TABLE public.recommend_custom (
	users_id varchar(50) NOT NULL,
	"text" varchar NOT NULL, -- 提示詞
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	sort int4 NOT NULL, -- 順序
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT recommend_custom_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX recommend_custom_users_id_idx ON public.recommend_custom USING btree (users_id);
COMMENT ON TABLE public.recommend_custom IS '自訂提示詞';

-- Column comments

COMMENT ON COLUMN public.recommend_custom."text" IS '提示詞';
COMMENT ON COLUMN public.recommend_custom.sort IS '順序';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.recommend_custom for each row execute function update_timestamp();


-- public.recommend_history definition

-- Drop table

-- DROP TABLE public.recommend_history;

CREATE TABLE public.recommend_history (
	users_id varchar(50) NOT NULL, -- 使用者id
	"text" varchar NOT NULL, -- 提示詞
	"time" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 歷史訊息時間
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	expert_id varchar(50) NOT NULL,
	CONSTRAINT recommend_history_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE,
	CONSTRAINT recommend_history_fk1 FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.recommend_history IS '歷史提示詞';

-- Column comments

COMMENT ON COLUMN public.recommend_history.users_id IS '使用者id';
COMMENT ON COLUMN public.recommend_history."text" IS '提示詞';
COMMENT ON COLUMN public.recommend_history."time" IS '歷史訊息時間';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.recommend_history for each row execute function update_timestamp();


-- public.recommend_preset definition

-- Drop table

-- DROP TABLE public.recommend_preset;

CREATE TABLE public.recommend_preset (
	id int4 NOT NULL,
	"text" varchar(255) NULL, -- 提示詞
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	expert_id varchar(50) NOT NULL,
	CONSTRAINT recommend_preset_pk PRIMARY KEY (id, expert_id),
	CONSTRAINT recommend_preset_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.recommend_preset IS '預設提示詞';

-- Column comments

COMMENT ON COLUMN public.recommend_preset."text" IS '提示詞';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.recommend_preset for each row execute function update_timestamp();


-- public.upload_folder definition

-- Drop table

-- DROP TABLE public.upload_folder;

CREATE TABLE public.upload_folder (
	id varchar(50) NOT NULL,
	datasource_id varchar(50) NOT NULL, -- 數據源id
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"name" varchar(255) NULL, -- 資料夾名稱
	CONSTRAINT upload_folder_pk PRIMARY KEY (id),
	CONSTRAINT upload_folder_fk FOREIGN KEY (datasource_id) REFERENCES public.datasource(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.upload_folder IS '上傳檔案的資料表';

-- Column comments

COMMENT ON COLUMN public.upload_folder.datasource_id IS '數據源id';
COMMENT ON COLUMN public.upload_folder."name" IS '資料夾名稱';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.upload_folder for each row execute function update_timestamp();


-- public.user_rooms definition

-- Drop table

-- DROP TABLE public.user_rooms;

CREATE TABLE public.user_rooms (
	room_id varchar(50) NOT NULL, -- 房號
	user1_uid varchar(50) NOT NULL, -- 第一個使用者
	user2_uid varchar(50) NOT NULL, -- 第二個使用者
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT user_room_pk PRIMARY KEY (room_id),
	CONSTRAINT user_rooms_un UNIQUE (user1_uid, user2_uid),
	CONSTRAINT user_room_fk FOREIGN KEY (user1_uid) REFERENCES public.users(id),
	CONSTRAINT user_room_fk_1 FOREIGN KEY (user2_uid) REFERENCES public.users(id)
);
COMMENT ON TABLE public.user_rooms IS '使用者房間';

-- Column comments

COMMENT ON COLUMN public.user_rooms.room_id IS '房號';
COMMENT ON COLUMN public.user_rooms.user1_uid IS '第一個使用者';
COMMENT ON COLUMN public.user_rooms.user2_uid IS '第二個使用者';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.user_rooms for each row execute function update_timestamp();


-- public.crawler_synchronize definition

-- Drop table

-- DROP TABLE public.crawler_synchronize;

CREATE TABLE public.crawler_synchronize (
	id int8 NOT NULL DEFAULT nextval('synchronize_id_seq'::regclass), -- 自增id
	datasource_id varchar(50) NOT NULL, -- 關聯資料源
	crawler_id varchar(50) NOT NULL, -- 還未關聯爬蟲表
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	config_jsonb jsonb NULL, -- 當下同步用的tag等
	training_state int2 NOT NULL DEFAULT 0, -- 訓練狀態¶0:上傳失敗¶1:上傳成功¶2:建索引中¶3:建立成功¶4:禁用¶5:已刪除¶99:檔案毀損
	CONSTRAINT crawler_synchronize_pk PRIMARY KEY (id),
	CONSTRAINT crawler_synchronize_fk FOREIGN KEY (datasource_id) REFERENCES public.datasource(id)
);
COMMENT ON TABLE public.crawler_synchronize IS '同步表';

-- Column comments

COMMENT ON COLUMN public.crawler_synchronize.id IS '自增id';
COMMENT ON COLUMN public.crawler_synchronize.datasource_id IS '關聯資料源';
COMMENT ON COLUMN public.crawler_synchronize.crawler_id IS '還未關聯爬蟲表';
COMMENT ON COLUMN public.crawler_synchronize.config_jsonb IS '當下同步用的tag等';
COMMENT ON COLUMN public.crawler_synchronize.training_state IS '訓練狀態
0:上傳失敗
1:上傳成功
2:建索引中
3:建立成功
4:禁用
5:已刪除
99:檔案毀損';


-- public.upload_documents definition

-- Drop table

-- DROP TABLE public.upload_documents;

CREATE TABLE public.upload_documents (
	id varchar(50) NOT NULL,
	filename varchar(255) NOT NULL, -- 存檔名
	originalname varchar(255) NOT NULL, -- 原始名
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	is_enable int4 NOT NULL DEFAULT 1, -- 是否啟用
	training_state int4 NOT NULL DEFAULT 0, -- 訓練狀態¶0:上傳失敗¶1:上傳成功¶2:建索引中¶3:建立成功¶4:禁用¶5:已刪除¶99:檔案毀損
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	upload_folder_id varchar(50) NOT NULL,
	datasets_id varchar(50) NOT NULL,
	CONSTRAINT upload_documents_pk PRIMARY KEY (id),
	CONSTRAINT upload_documents_fk FOREIGN KEY (upload_folder_id) REFERENCES public.upload_folder(id) ON DELETE CASCADE
);
CREATE INDEX upload_documents_datasets_id_idx ON public.upload_documents USING btree (datasets_id);
CREATE UNIQUE INDEX upload_documents_id_idx ON public.upload_documents USING btree (id);
COMMENT ON TABLE public.upload_documents IS '資料集檔案';

-- Column comments

COMMENT ON COLUMN public.upload_documents.filename IS '存檔名';
COMMENT ON COLUMN public.upload_documents.originalname IS '原始名';
COMMENT ON COLUMN public.upload_documents.is_enable IS '是否啟用';
COMMENT ON COLUMN public.upload_documents.training_state IS '訓練狀態
0:上傳失敗
1:上傳成功
2:建索引中
3:建立成功
4:禁用
5:已刪除
99:檔案毀損';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.upload_documents for each row execute function update_timestamp();


-- public.user_messages definition

-- Drop table

-- DROP TABLE public.user_messages;

CREATE TABLE public.user_messages (
	room_id varchar(50) NOT NULL, -- 房號
	from_uid varchar(50) NOT NULL, -- 發送人
	to_uid varchar(50) NOT NULL, -- 接收人
	message varchar NOT NULL, -- 訊息
	message_type varchar NOT NULL, -- 訊息類別
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT user_messages_fk FOREIGN KEY (room_id) REFERENCES public.user_rooms(room_id)
);
CREATE INDEX messages_room_id_idx ON public.user_messages USING btree (room_id);
COMMENT ON TABLE public.user_messages IS '使用者聊天';

-- Column comments

COMMENT ON COLUMN public.user_messages.room_id IS '房號';
COMMENT ON COLUMN public.user_messages.from_uid IS '發送人';
COMMENT ON COLUMN public.user_messages.to_uid IS '接收人';
COMMENT ON COLUMN public.user_messages.message IS '訊息';
COMMENT ON COLUMN public.user_messages.message_type IS '訊息類別';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.user_messages for each row execute function update_timestamp();


-- public.crawler_documents definition

-- Drop table

-- DROP TABLE public.crawler_documents;

CREATE TABLE public.crawler_documents (
	id varchar(50) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	filename varchar(255) NOT NULL, -- 文件名
	"date" date NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 當日
	is_enable int2 NOT NULL DEFAULT 1, -- 默認啟用
	crawler_synchronize_id int8 NOT NULL, -- 關聯同步表
	CONSTRAINT crawler_documents_pk PRIMARY KEY (id),
	CONSTRAINT crawler_documents_fk FOREIGN KEY (crawler_synchronize_id) REFERENCES public.crawler_synchronize(id)
);
COMMENT ON TABLE public.crawler_documents IS '爬蟲文件表';

-- Column comments

COMMENT ON COLUMN public.crawler_documents.filename IS '文件名';
COMMENT ON COLUMN public.crawler_documents."date" IS '當日';
COMMENT ON COLUMN public.crawler_documents.is_enable IS '默認啟用';
COMMENT ON COLUMN public.crawler_documents.crawler_synchronize_id IS '關聯同步表';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.crawler_documents for each row execute function update_timestamp();


-- public.crawler_documents_qa definition

-- Drop table

-- DROP TABLE public.crawler_documents_qa;

CREATE TABLE public.crawler_documents_qa (
	id varchar(50) NOT NULL,
	question_original varchar NULL, -- 原本的問題
	answer_original varchar NULL, -- 原本的答案
	question varchar NULL, -- 問題
	answer varchar NULL, -- 答案
	adorn jsonb NULL, -- 修飾過的答案
	crawler_documents_id varchar(50) NOT NULL, -- 關聯爬蟲文件
	info jsonb NULL, -- 網站本身如果有qa的id
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	is_enable int2 NOT NULL DEFAULT 1, -- 是否啟用
	crawler_id varchar(50) NOT NULL, -- 還未關聯爬蟲id
	hash varchar(50) NOT NULL, -- qa的md5值
	CONSTRAINT crawler_documents_qa_pk PRIMARY KEY (id),
	CONSTRAINT crawler_documents_qa_fk FOREIGN KEY (crawler_documents_id) REFERENCES public.crawler_documents(id)
);
COMMENT ON TABLE public.crawler_documents_qa IS '爬到的文件QA';

-- Column comments

COMMENT ON COLUMN public.crawler_documents_qa.question_original IS '原本的問題';
COMMENT ON COLUMN public.crawler_documents_qa.answer_original IS '原本的答案';
COMMENT ON COLUMN public.crawler_documents_qa.question IS '問題';
COMMENT ON COLUMN public.crawler_documents_qa.answer IS '答案';
COMMENT ON COLUMN public.crawler_documents_qa.adorn IS '修飾過的答案';
COMMENT ON COLUMN public.crawler_documents_qa.crawler_documents_id IS '關聯爬蟲文件';
COMMENT ON COLUMN public.crawler_documents_qa.info IS '網站本身如果有qa的id';
COMMENT ON COLUMN public.crawler_documents_qa.is_enable IS '是否啟用';
COMMENT ON COLUMN public.crawler_documents_qa.crawler_id IS '還未關聯爬蟲id';
COMMENT ON COLUMN public.crawler_documents_qa.hash IS 'qa的md5值';

-- Table Triggers

create trigger update_table_trigger before
update
    on
    public.crawler_documents_qa for each row execute function update_timestamp();