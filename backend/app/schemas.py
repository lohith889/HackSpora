import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Any


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    mobile_number: str = Field(..., min_length=10, max_length=15)
    date_of_birth: datetime.date
    gender: str = Field(..., min_length=1, max_length=20)
    category: Optional[str] = "General"


class UserRegister(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    project: str
    version: str
