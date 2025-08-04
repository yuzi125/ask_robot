const pgsql = require("../pgsql");
const fs = require("fs");

let fullSql = `
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
	prompt varchar(5000) NULL,
	CONSTRAINT expert_pk PRIMARY KEY (id)
);

INSERT INTO public.expert
(id, "name", welcome, avatar, url)
VALUES('a58d56db-2fda-4520-b4cf-7a272a4a1a62', 'AVA', '歡迎使用Ava，您的智慧特助', './robot.png', '1sP3MiL5D4Y0TzRC');
INSERT INTO public.expert
(id, "name", welcome, avatar, url)
VALUES('4373cbe5-41b0-4dba-bb75-a413fc887140', 'ERP專家', '歡迎使用ERP專家', './robot.png', 'vR1AnoG0clzKbu2H');

ALTER TABLE public.bot_messages ADD expert_id varchar(50) NOT NULL DEFAULT 'a58d56db-2fda-4520-b4cf-7a272a4a1a62';

ALTER TABLE public.bot_messages ADD CONSTRAINT bot_messages_expert_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id);
ALTER TABLE public.bot_messages DROP CONSTRAINT bot_messages_un;
ALTER TABLE public.bot_messages ADD CONSTRAINT bot_messages_un UNIQUE (users_id,expert_id);

ALTER TABLE public.datasets ADD config_jsonb jsonb NULL;
ALTER TABLE public.expert ADD config_jsonb jsonb NULL;


CREATE TABLE public.expert_datasets_mapping (
	expert_id varchar(50) NOT NULL,
	datasets_id varchar(50) NOT NULL,
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT expert_datasets_mapping_pk PRIMARY KEY (expert_id, datasets_id)
);

DELETE FROM public.datasets; -- 為了測試機 先清除掉

ALTER TABLE public.datasets ALTER COLUMN create_time TYPE timestamptz USING create_time::timestamptz;
ALTER TABLE public.datasets ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.datasets ADD folder_name varchar(50) NOT NULL DEFAULT '';

ALTER TABLE public.expert_datasets_mapping ADD create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.expert_datasets_mapping ADD CONSTRAINT expert_datasets_mapping_fk FOREIGN KEY (expert_id) REFERENCES public.expert(id) ON DELETE CASCADE;
ALTER TABLE public.expert_datasets_mapping ADD CONSTRAINT expert_datasets_mapping_fk_1 FOREIGN KEY (datasets_id) REFERENCES public.datasets(id) ON DELETE CASCADE;
ALTER TABLE public.datasets DROP COLUMN count;
ALTER TABLE public.documents ALTER COLUMN create_time TYPE timestamptz USING create_time::timestamptz;
ALTER TABLE public.documents ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.documents ADD CONSTRAINT documents_pk PRIMARY KEY (id);
ALTER TABLE public.documents DROP CONSTRAINT documents_fk;
ALTER TABLE public.documents ADD CONSTRAINT documents_fk FOREIGN KEY (datasets_id) REFERENCES public.datasets(id) ON DELETE CASCADE;
ALTER TABLE public.expert ADD create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.expert ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.recommend_custom ALTER COLUMN create_time TYPE timestamptz USING create_time::timestamptz;
ALTER TABLE public.recommend_custom ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.recommend_preset ADD create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.recommend_preset ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.settings ADD CONSTRAINT settings_pk PRIMARY KEY ("key");
ALTER TABLE public.users ADD create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD user_info jsonb NULL;
ALTER TABLE public.user_rooms ALTER COLUMN create_time TYPE timestamptz USING create_time::timestamptz;
ALTER TABLE public.user_rooms ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_messages ALTER COLUMN create_time TYPE timestamptz USING create_time::timestamptz;
ALTER TABLE public.user_messages ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.bot_messages ALTER COLUMN create_time TYPE timestamptz USING create_time::timestamptz;
ALTER TABLE public.bot_messages ADD update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;


ALTER TABLE public.recommend_custom DROP CONSTRAINT recommend_custom_fk;
ALTER TABLE public.recommend_custom ADD CONSTRAINT recommend_custom_fk FOREIGN KEY (users_id) REFERENCES public.users(uid) ON DELETE CASCADE;



CREATE TABLE public.recommend_history (
	users_id varchar(50) NOT NULL, -- 使用者id
	"text" varchar NOT NULL, -- 提示詞
	"time" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 歷史訊息時間
	create_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.recommend_history ADD CONSTRAINT recommend_history_fk FOREIGN KEY (users_id) REFERENCES public.users(uid) ON DELETE CASCADE;








`;

let j1 = {
    system_prompt: `You are a courteous HR officer who is well-versed in the company's leave management 
regulations. You will answer users' questions based on the provided regulations in a 
gentle, understanding, and considerate tone.`,
    intention: "Inquire about the rules for taking leave.",
    examples: ["下個月就要結婚了，請問婚假怎麼請 ?", "陪太去產檢可以請假嗎?", "外祖父去糺可以請幾天喪假?"],
    search_kwargs: { k: 3 },
};
let j2 = {
    system_prompt: `You are an HR administrative officer with deep expertise in the company's 'Business 
Travel Management Regulations'. You provide direct and honest responses to users' 
inquiries about various aspects of the company's travel management policies. Your 
knowledge and recommendations are confined to the company's management policy 
documents, so refrain from excessive elaboration.`,
    intention: "Inquire about business trip management regulations.",
    examples: [
        "出差住宿費怎麼報",
        "出差申請程序如何",
        "出差後怎麼報支",
        "出差後沒有報支會怎樣",
        "經理出差台北的住宿補助額度有多少",
    ],
    search_kwargs: { k: 3 },
};
let j3 = {
    system_prompt: `You are an administrative officer well-versed in the company's 'Sales Contract 
Management Regulations'. You provide direct and honest responses to users' inquiries 
about various aspects of the company's contract signing policies. Your knowledge and 
advice are limited to the company's management policy documents, so avoid providing 
excessive explanations.`,
    intention: "Inquire about the rules for Signing Engineering Contract or Sales Agreement",
    examples: ["合約金額超過 300 萬元以上有甚麼要注意?", "集團外承攬合約有甚麼要注意", "有哪些合約種類"],
    search_kwargs: { k: 3 },
};
let j4 = {
    system_prompt: `You are an information system environment maintenance manager. Please answer about 
your knowledge and experience related to past information system failures.`,
    intention: `Inquire about the past information system failure experiences and repair processes of 
customers, as well as recommendations for improvement. Metadata Path: {metadata}`,
    examples: ["新華冶金", "中龍電商"],
    search_kwargs: { k: 3 },
};

let fullSql2 = `INSERT INTO public.datasets
(id, "name", "describe", config_jsonb, folder_name)
VALUES('070f03a5-9d31-4b49-8b63-43eccfc7d9ba', 'hd', 'useful for when you want to answer queries about the hd', $1, 'hd'),
('0fd060f9-dc44-4c16-9480-9220f1fa73a3', 'biztrip', 'useful for when you want to answer queries about the biztrip', $2, 'biztrip'),
('30f3d749-2f3b-45f1-8a23-bd6746b90dfd', 'contracts', 'useful for when you want to answer queries about the contracts', $3, 'contracts'),
('ab15f10d-d37d-45ca-96f2-0273c63f7467', 'op', 'useful for when you want to answer queries about the op', $4, 'op');
`;

let fullSql3 = `INSERT INTO public.expert_datasets_mapping
(expert_id, datasets_id)
VALUES('a58d56db-2fda-4520-b4cf-7a272a4a1a62', '070f03a5-9d31-4b49-8b63-43eccfc7d9ba'),
('a58d56db-2fda-4520-b4cf-7a272a4a1a62', '0fd060f9-dc44-4c16-9480-9220f1fa73a3'),
('a58d56db-2fda-4520-b4cf-7a272a4a1a62', '30f3d749-2f3b-45f1-8a23-bd6746b90dfd'),
('a58d56db-2fda-4520-b4cf-7a272a4a1a62', 'ab15f10d-d37d-45ca-96f2-0273c63f7467');`;

let trig = fs.readFileSync("./db/updateTimeTrigger.sql", "utf-8");

(async function () {
    await pgsql.query(fullSql);
    console.log("完畢1");
    await pgsql.query(fullSql2, [j1, j2, j3, j4]);
    console.log("完畢2");
    await pgsql.query(fullSql3);
    console.log("完畢3");
    await pgsql.query(trig);
    console.log("trigger建立完畢");
    process.exit();
})();
