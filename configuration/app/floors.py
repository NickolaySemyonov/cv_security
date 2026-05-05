# floors.py (если нет — создайте в папке app)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Floor, User
from schemas import FloorCreate, FloorResponse
from security import get_current_user

router = APIRouter(prefix="/floors", tags=["floors"])

@router.get("/", response_model=List[FloorResponse])
async def get_floors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    floors = db.query(Floor).all()
    return floors

@router.post("/", response_model=FloorResponse)
async def create_floor(
    floor_data: FloorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Floor).filter(
        Floor.place == floor_data.place,
        Floor.number == floor_data.number
    ).first()
    
    if existing:
        raise HTTPException(409, f"Этаж {floor_data.number} у объекта '{floor_data.place}' уже существует")
    
    floor = Floor(**floor_data.model_dump())
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return floor

@router.delete("/{floor_id}")
async def delete_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    db.delete(floor)
    db.commit()
    return {"message": "Этаж успешно удалён"}