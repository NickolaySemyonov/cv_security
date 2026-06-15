from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import Action, User
from schemas import ActionResponse, ActionLogsResponse
from security import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/", response_model=ActionLogsResponse)
async def get_logs(
    page: int = Query(1, ge=1, description="Номер страницы"),
    limit: int = Query(50, ge=1, le=200, description="Записей на странице"),
    user_id: Optional[int] = Query(None, description="Фильтр по пользователю"),
    start_date: Optional[datetime] = Query(None, description="Начальная дата"),
    end_date: Optional[datetime] = Query(None, description="Конечная дата"),
    search: Optional[str] = Query(None, description="Поиск по заголовку или тексту"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Action).join(User, Action.user_id == User.id)
    
    if user_id:
        query = query.filter(Action.user_id == user_id)
    
    if start_date:
        query = query.filter(Action.time >= start_date)
    
    if end_date:
        query = query.filter(Action.time <= end_date)
    
    if search:
        query = query.filter(
            (Action.title.ilike(f"%{search}%")) | 
            (Action.text_.ilike(f"%{search}%"))
        )
    
    total = query.count()
    offset = (page - 1) * limit
    actions = query.order_by(Action.time.desc()).offset(offset).limit(limit).all()
    
    user_ids = list(set([action.user_id for action in actions]))
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {user.id: user for user in users}
    
    items = []
    for action in actions:
        user = user_map.get(action.user_id)
        items.append(ActionResponse(
            id=action.id,
            time=action.time,
            title=action.title,
            text=action.text_,
            user_id=action.user_id,
            user_login=user.login if user else "Система"
        ))
    
    return ActionLogsResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=(total + limit - 1) // limit
    )


@router.get("/users")
async def get_log_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.query(User).join(Action, User.id == Action.user_id).distinct().all()
    return [
        {"id": user.id, "login": user.login} 
        for user in users
    ]