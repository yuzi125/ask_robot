class OcrDocumentsTokenLogEntry:

    def __init__(
        self,
        model_list_id,
        id=None,
        datasets_id=None,
        upload_document_id=None,
        model=None,
        document_type=None,
        prompt_token=None,
        completion_token=None,
        prompt_rate=None,
        completion_rate=None,
        price=None,
        price_currency="USD",
        create_time=None,
        update_time=None,
    ):
        self.id = id
        self.datasets_id = datasets_id
        self.upload_document_id = upload_document_id
        self.model = model
        self.model_list_id = model_list_id
        self.document_type = document_type
        self.prompt_token = prompt_token
        self.completion_token = completion_token
        self.prompt_rate = prompt_rate
        self.completion_rate = completion_rate
        self.price = price
        self.price_currency = price_currency
        self.create_time = create_time
        self.update_time = update_time

    def __str__(self):
        return (f"OcrDocumentsTokenLogEntry(id={self.id}, "
                f"datasets_id={self.datasets_id}, "
                f"upload_document_id={self.upload_document_id}, "
                f"model={self.model}, "
                f"model_list_id={self.model_list_id}, "
                f"document_type={self.document_type}, "
                f"prompt_token={self.prompt_token}, "
                f"completion_token={self.completion_token}, "
                f"prompt_rate={self.prompt_rate}, "
                f"completion_rate={self.completion_rate}, "
                f"price={self.price}, "
                f"price_currency={self.price_currency}, "
                f"create_time={self.create_time}, "
                f"update_time={self.update_time})")
