class EmbeddingTokenLogEntry:

    def __init__(
        self,
        id=None,
        create_time=None,
        update_time=None,
        model=None,
        model_id=None,
        prompt_token=None,
        datasets_id=None,
        prompt_rate=None,
        price=None,
        price_currency="USD",
    ):
        self.id = id
        self.create_time = create_time
        self.update_time = update_time
        self.model = model
        self.model_id = model_id
        self.prompt_token = prompt_token
        self.datasets_id = datasets_id
        self.prompt_rate = prompt_rate
        self.price = price
        self.price_currency = price_currency

    def __str__(self):
        return (f"EmbeddingTokenLogEntry(id={self.id}, "
                f"create_time={self.create_time}, "
                f"update_time={self.update_time}, "
                f"model={self.model}, "
                f"model_id={self.model_id}, "
                f"prompt_token={self.prompt_token}, "
                f"datasets_id={self.datasets_id}, "
                f"prompt_rate={self.prompt_rate}, "
                f"price={self.price})"
                f"price_currency={self.price_currency})")
