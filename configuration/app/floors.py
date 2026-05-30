from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Floor, User, Camera, Area
from schemas import FloorCreate, FloorResponse, FloorUpdate, FloorDeleteResponse
from security import get_current_user
from crud.logs import action_logger
from crud.camera import camera_crud

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
    if not floor_data.map or len(floor_data.map.strip()) == 0:
        raise HTTPException(400, "Необходимо загрузить карту этажа (SVG файл)")
    
    if not floor_data.map.startswith('<svg'):
        raise HTTPException(400, "Неверный формат карты. Ожидается SVG файл")
    
    existing = db.query(Floor).filter(
        Floor.place == floor_data.place,
        Floor.number == floor_data.number
    ).first()
    
    if existing:
        raise HTTPException(409, f"Этаж {floor_data.number} у объекта '{floor_data.place}' уже существует")
    
    floor = Floor(
        number=floor_data.number,
        place=floor_data.place,
        map=floor_data.map
    )
    db.add(floor)
    db.commit()
    db.refresh(floor)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="СОЗДАНИЕ ЭТАЖА",
        text=f"Создан этаж {floor.number} у объекта '{floor.place}'"
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
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="ОБНОВЛЕНИЕ ЭТАЖА",
        text=f"Обновлен этаж {floor.number} у объекта '{floor.place}'"
    )
    
    return floor

@router.delete("/{floor_id}", response_model=FloorDeleteResponse)
async def delete_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    cameras_deleted = camera_crud.delete_by_floor(db, floor_id)
    
    areas = db.query(Area).filter(Area.floor_id == floor_id).all()
    areas_deleted = len(areas)
    for area in areas:
        db.delete(area)
    
    floor_info = f"Этаж {floor.number} у объекта '{floor.place}', ID: {floor.id}"
    
    db.delete(floor)
    db.commit()
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="УДАЛЕНИЕ ЭТАЖА",
        text=f"Удален {floor_info}, удалено камер: {cameras_deleted}, удалено зон: {areas_deleted}"
    )
    
    return FloorDeleteResponse(
        message="Этаж успешно удалён",
        cameras_deleted=cameras_deleted,
        areas_deleted=areas_deleted
    )