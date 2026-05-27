# backend/app/auth.py (исправленный)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import jwt
import os
from database import get_db
from crud.user import user
from crud.logs import action_logger
from schemas import UserLogin, TokenResponse, UserResponse, RefreshResponse, RefreshRequest

router = APIRouter(prefix="/auth", tags=["authentication"])

SECRET_KEY = "gagara"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 
REFRESH_TOKEN_EXPIRE_DAYS = 7     

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    authenticated_user = user.authenticate(db, login_data)
    
    if not authenticated_user:
        action_logger.log(
            db, 
            user_id=0,
            title="ОШИБКА ВХОДА",
            text=f"Неудачная попытка входа с логином: {login_data.login}"
        )
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    
    access_token = create_access_token(
        data={"sub": str(authenticated_user.id), "login": authenticated_user.login}
    )
    
    refresh_token = create_refresh_token(
        data={"sub": str(authenticated_user.id), "login": authenticated_user.login, "type": "refresh"}
    )
    
    action_logger.log(
        db,
        user_id=authenticated_user.id,
        title="УСПЕШНЫЙ ВХОД",
        text=f"Пользователь {authenticated_user.login} вошел в систему"
    )
    
    # ВАЖНО: добавляем поле role!
    user_response = UserResponse(
        id=authenticated_user.id,
        login=authenticated_user.login,
        role=authenticated_user.role  # Добавлено поле role
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_response
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(request.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Неверный тип токена")
        
        user_id = int(payload.get("sub"))
        if user_id is None:
            raise HTTPException(status_code=401, detail="Неверный токен")
        
        current_user = user.get_by_id(db, user_id)
        if current_user is None:
            raise HTTPException(status_code=401, detail="Пользователь не найден")
        
        new_access_token = create_access_token(
            data={"sub": str(current_user.id), "login": current_user.login}
        )
        new_refresh_token = create_refresh_token(
            data={"sub": str(current_user.id), "login": current_user.login, "type": "refresh"}
        )
        
        return RefreshResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh токен истек, войдите заново")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Неверный refresh токен")