from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, Action
from schemas import UserCreate, UserResponse
from security import get_current_user, require_admin
from crud.user import user as user_crud
from crud.logs import action_logger

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/register-operator", response_model=UserResponse)
async def register_operator(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    existing_user = user_crud.get_by_login(db, user_data.login)
    if existing_user:
        raise HTTPException(400, "Пользователь с таким логином уже существует")
    
    new_user = user_crud.create_operator(db, user_data)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="СОЗДАНИЕ ОПЕРАТОРА",
        text=f"Админ {current_user.login} создал оператора {new_user.login}"
    )
    
    return UserResponse(
        id=new_user.id,
        login=new_user.login,
        role=new_user.role
    )

@router.get("/operators", response_model=List[UserResponse])
async def get_operators(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    operators = user_crud.get_all_operators(db)
    return [
        UserResponse(id=op.id, login=op.login, role=op.role)
        for op in operators
    ]

@router.delete("/{user_id}")
async def delete_operator(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if current_user.id == user_id:
        raise HTTPException(400, "Нельзя удалить самого себя")
    
    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(404, "Пользователь не найден")
    
    if user_to_delete.role == 'admin':
        raise HTTPException(400, "Нельзя удалить администратора")
    
    try:
        actions = db.query(Action).filter(Action.user_id == user_id).all()
        for action in actions:
            db.delete(action)
        
        db.delete(user_to_delete)
        db.commit()
        
        action_logger.log(
            db,
            user_id=current_user.id,
            title="УДАЛЕНИЕ ОПЕРАТОРА",
            text=f"Админ {current_user.login} удалил оператора {user_to_delete.login}"
        )
        
        return {"message": "Оператор удалён", "success": True}
    except Exception as e:
        db.rollback()
        print(f"Ошибка при удалении: {e}")
        raise HTTPException(500, f"Ошибка при удалении: {str(e)}")