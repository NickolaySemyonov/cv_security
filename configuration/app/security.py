import os
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pathlib import Path
from dotenv import load_dotenv
from database import get_db
from crud.user import user
from models import User

# Загружаем .env из корня проекта
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

security = HTTPBearer()
SECRET_KEY = os.getenv("SECRET_KEY", "gagara_super_secret_key_2026_for_cv_security_system_very_long_key_12345")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        if user_id is None:
            raise HTTPException(status_code=401, detail="Неверный токен")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Токен истек")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Неверный токен")
    
    current_user = user.get_by_id(db, user_id)
    if current_user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    
    return current_user

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Доступ запрещён. Требуются права администратора.")
    return current_user

def require_operator_or_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'operator']:
        raise HTTPException(status_code=403, detail="Доступ запрещён.")
    return current_user