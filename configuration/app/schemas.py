# schemas.py
from pydantic import BaseModel, Field
from typing import Optional

class UserLogin(BaseModel):
    login: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4)

class UserResponse(BaseModel):
    id: int
    login: str
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str 
    token_type: str = "bearer"
    user: UserResponse

class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"