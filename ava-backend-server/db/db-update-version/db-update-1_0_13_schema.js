const sqlArr = [
    `ALTER TABLE public.model_token_log RENAME COLUMN price_usd TO price;`,
    `ALTER TABLE public.model_token_log ADD price_currency varchar DEFAULT 'USD' NOT NULL;`,
    `COMMENT ON COLUMN public.model_token_log.price_currency IS '幣別';`,
    `ALTER TABLE public.embedding_token_log RENAME COLUMN price_usd TO price;`,
    `ALTER TABLE public.embedding_token_log ADD price_currency varchar DEFAULT 'USD' NOT NULL;`,
    `COMMENT ON COLUMN public.embedding_token_log.price_currency IS '幣別';`,
];
module.exports = sqlArr;
