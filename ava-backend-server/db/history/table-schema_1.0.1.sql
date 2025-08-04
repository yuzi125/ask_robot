CREATE TABLE public.users (
	uid varchar(50) NOT NULL,
	nickname varchar(50) NOT NULL,
	avatar varchar(1000) NULL,
	user_no varchar(50) NULL,
	post_no varchar(50) NULL,
	dep_no varchar(50) NULL,
	id_type varchar(50) NULL,
	comp_no varchar(50) NULL,
	e_mail varchar(100) NULL,
	sex varchar(50) NULL,
	birthday varchar(50) NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	user_info jsonb NULL,
	CONSTRAINT user_pk PRIMARY KEY (uid),
	CONSTRAINT users_un UNIQUE (user_no)
);

CREATE TABLE public.bot_messages (
	group_id varchar(50) NOT NULL,
	users_id varchar(50) NOT NULL,
	subject varchar(50) NOT NULL,
	chat jsonb NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	context jsonb NULL,
	expert_id varchar(50) NOT NULL,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT bot_messages_pk PRIMARY KEY (group_id),
	CONSTRAINT bot_messages_un UNIQUE (users_id, expert_id),
	CONSTRAINT bot_messages_expert_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id),
	CONSTRAINT bot_messages_fk FOREIGN KEY (users_id) REFERENCES public.users(uid)
);

CREATE TABLE public.user_rooms (
	room_id varchar(50) NOT NULL,
	user1_uid varchar(50) NOT NULL,
	user2_uid varchar(50) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT user_room_pk PRIMARY KEY (room_id),
	CONSTRAINT user_rooms_un UNIQUE (user1_uid, user2_uid),
	CONSTRAINT user_room_fk FOREIGN KEY (user1_uid) REFERENCES public.users(uid),
	CONSTRAINT user_room_fk_1 FOREIGN KEY (user2_uid) REFERENCES public.users(uid)
);

CREATE TABLE public.user_messages (
	room_id varchar(50) NOT NULL,
	from_uid varchar(50) NOT NULL,
	to_uid varchar(50) NOT NULL,
	message varchar NOT NULL,
	message_type varchar NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT user_messages_fk FOREIGN KEY (room_id) REFERENCES public.user_rooms(room_id)
);
CREATE INDEX messages_room_id_idx ON public.user_messages USING btree (room_id);

CREATE TABLE public.recommend_custom (
	users_id varchar(50) NOT NULL,
	"text" varchar NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	sort int4 NOT NULL,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT recommend_custom_fk FOREIGN KEY (users_id) REFERENCES public.users(uid) ON DELETE CASCADE
);
CREATE INDEX recommend_custom_users_id_idx ON public.recommend_custom USING btree (users_id);

CREATE TABLE public.recommend_preset (
	id int4 NOT NULL,
	"text" varchar(255) NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT recommend_preset_pk PRIMARY KEY (id)
);