from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        from bson import ObjectId
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


class ResponseModel(BaseModel):
    success: bool = True
    message: str = ""
    data: Optional[Any] = None


class PaginatedResponse(BaseModel):
    success: bool = True
    data: Any
    total: int
    page: int
    per_page: int
    total_pages: int
