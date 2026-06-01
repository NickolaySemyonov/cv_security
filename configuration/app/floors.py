from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Floor, User, Camera, Area
from schemas import FloorCreate, FloorResponse, FloorUpdate
from security import get_current_user
from crud.logs import action_logger

router = APIRouter(prefix="/floors", tags=["floors"])

@router.get("/", response_model=List[FloorResponse])
async def get_floors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    floors = db.query(Floor).all()
    return floors

@router.get("/{floor_id}", response_model=FloorResponse)
async def get_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    return floor

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
    
    floor = Floor(**floor_data.dict())
    db.add(floor)
    db.commit()
    db.refresh(floor)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="СОЗДАНИЕ ЭТАЖА",
        text=f"Создан этаж {floor.number} у объекта '{floor.place}', ID: {floor.id}"
    )
    
    return floor

@router.patch("/{floor_id}", response_model=FloorResponse)
async def update_floor(
    floor_id: int,
    floor_data: FloorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    update_data = floor_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(floor, field, value)
    
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
    
    # Сначала удаляем камеры
    cameras = db.query(Camera).filter(Camera.floor_id == floor_id).all()
    for camera in cameras:
        db.delete(camera)
    
    # Удаляем зоны
    areas = db.query(Area).filter(Area.floor_id == floor_id).all()
    for area in areas:
        db.delete(area)
    
    floor_info = f"Этаж {floor.number} у объекта '{floor.place}', ID: {floor.id}"
    
    db.delete(floor)
    db.commit()
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="УДАЛЕНИЕ ЭТАЖА",
        text=f"Удален {floor_info}, удалено камер: {len(cameras)}, удалено зон: {len(areas)}"
    )
    
    return {"message": "Этаж успешно удалён", "cameras_deleted": len(cameras), "areas_deleted": len(areas)}