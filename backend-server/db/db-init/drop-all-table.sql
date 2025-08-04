-- Drop tables in reverse order of creation to avoid foreign key constraints
DROP TABLE public.bot_messages;
DROP TABLE public.crawler;
DROP TABLE public.crawler_documents;
DROP TABLE public.crawler_documents_qa;
DROP TABLE public.crawler_synchronize;
DROP TABLE public.datasets;
DROP TABLE public.datasource;
DROP TABLE public.datasource_type;
DROP TABLE public.documents;
DROP TABLE public.expert;
DROP TABLE public.expert_datasets_mapping;
DROP TABLE public.expert_skill_mapping;
DROP TABLE public.expert_users_mapping;
DROP TABLE public.history_messages;
DROP TABLE public.model_token_log;
DROP TABLE public.recommend_custom;
DROP TABLE public.recommend_history;
DROP TABLE public.recommend_preset;
DROP TABLE public.settings;
DROP TABLE public.skill;
DROP TABLE public.upload_documents;
DROP TABLE public.upload_folder;
DROP TABLE public.user_messages;
DROP TABLE public.user_rooms;
DROP TABLE public.users;


