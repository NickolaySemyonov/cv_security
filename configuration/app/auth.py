# auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import jwt
import os
from database import get_db
from crud.user import user
from schemas import UserLogin, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])

SECRET_KEY = "gagara"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    authenticated_user = user.authenticate(db, login_data)
    
    if not authenticated_user:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    
    access_token = create_access_token(
        data={"sub": str(authenticated_user.id), "login": authenticated_user.login}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(authenticated_user)
    )