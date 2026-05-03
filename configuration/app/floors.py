# floors.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Floor, User
from schemas import FloorResponse
from security import get_current_user

router = APIRouter(prefix="/floors", tags=["floors"])

@router.get("/", response_model=List[FloorResponse])
async def get_floors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить список всех этажей"""
    floors = db.query(Floor).all()
    return floors

@router.get("/{floor_id}", response_model=FloorResponse)
async def get_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить конкретный этаж по ID"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(status_code=404, detail="Этаж не найден")
    return floor