class ModelTokenLogEntry:

    def __init__(self,
                 model_list_id,
                 users_id=None,
                 model=None,
                 classify=None,
                 prompt_token=None,
                 completion_token=None,
                 user_input=None,
                 expert_id=None,
                 expert_model=None,
                 expert_model_type=None,
                 prompt_rate=None,
                 completion_rate=None,
                 price=None,
                 price_currency="USD",
                 chat_uuid=None,
                 history_message_id=None):
        self.users_id = users_id
        self.model = model
        self.model_list_id: int = model_list_id
        self.classify = classify
        self.prompt_token = prompt_token
        self.completion_token = completion_token
        self.user_input = user_input
        self.expert_id = expert_id
        self.expert_model = expert_model
        self.expert_model_type = expert_model_type
        self.prompt_rate = prompt_rate
        self.completion_rate = completion_rate
        self.price = price
        self.price_currency = price_currency
        self.chat_uuid = chat_uuid
        self.history_message_id = history_message_id
    def __str__(self):
        return (f"ModelTokenLogEntry(users_id={self.users_id}, "
                f"model={self.model}, "
                f"model_list_id={self.model_list_id}, "
                f"classify={self.classify}, "
                f"prompt_token={self.prompt_token}, "
                f"completion_token={self.completion_token}, "
                f"user_input={self.user_input}, "
                f"expert_id={self.expert_id}, "
                f"expert_model={self.expert_model}, "
                f"expert_model_type={self.expert_model_type}, "
                f"prompt_rate={self.prompt_rate}, "
                f"completion_rate={self.completion_rate}, "
                f"price={self.price}, "
                f"chat_uuid={self.chat_uuid}, "
                f"history_message_id={self.history_message_id})")
