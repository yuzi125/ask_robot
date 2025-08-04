const datasets_config = {
    embedding_model: "text-embedding-3-large",
    model: "claude-3-haiku-20240307",
    model_params: { max_tokens: 1200, temperature: 0, frequency_penalty: 0, top_p: 1.0 },
    system_prompt: ``,
    content_replacement_list: {},
    intention: "",
    examples: [],
    search_kwargs: { k: 5 },
    tip: []
};
const skill_config = {
    model: "gpt-3.5-turb",
    model_params: { max_tokens: 1200, temperature: 0, frequency_penalty: 0, top_p: 1.0 },
    system_prompt: ``,
    intention: "",
    examples: [],
    search_kwargs: { k: 5 },
    webapi: {
        apiurl: "",
        method: "",
        body: {},
        query: {}, // ?a=a&b=b
        params: {}, // /a/b
        headers: {},
        required: [], // [{query:'name'},{body:'datasets_id'}]
        response_detail: {}, //回傳值詳細
    },
    tip: []
};
const expert_config = {
    model: "claude-3-haiku-20240307",
    model_params: { max_tokens: 1200, temperature: 0, frequency_penalty: 0, top_p: 1.0 },
    system_prompt: ``,
    content_replacement_list: {},

};
module.exports = { datasets_config, skill_config, expert_config };
