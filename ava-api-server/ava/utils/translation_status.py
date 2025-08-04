from enum import Enum


class TranslationStatus(Enum):
    PENDING = "pending"  # 等待處理
    PROCESSING = "processing"  # 處理中
    COMPLETED = "completed"  # 完成
    FAILED = "failed"  # 失敗
    ERROR = "error"  # 系統錯誤

    @classmethod
    def get_status(cls, status: str) -> "TranslationStatus":
        """Get enum member by value"""
        try:
            return cls(status)
        except ValueError:
            return cls.ERROR

    @classmethod
    def is_final_status(cls, status: str) -> bool:
        """Check if the status is a final status"""
        return status in [
            cls.COMPLETED.value, cls.FAILED.value, cls.ERROR.value
        ]
