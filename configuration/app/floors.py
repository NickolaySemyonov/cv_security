from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Floor, User, Camera, Area, Detection, Notification, Schedule
from schemas import FloorCreate, FloorResponse, FloorUpdate, FloorDeleteResponse
from security import get_current_user, require_admin
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
    current_user: User = Depends(require_admin)
):
    if not floor_data.map or len(floor_data.map.strip()) == 0:
        raise HTTPException(400, "Необходимо загрузить карту этажа (SVG файл)")
    
    # Проверяем наличие тега <svg (даже если есть XML-пролог)
    if '<svg' not in floor_data.map:
        raise HTTPException(400, "Неверный формат карты. Ожидается SVG файл")
    
    # Очищаем SVG от XML-пролога если нужно
    svg_content = floor_data.map
    svg_start = svg_content.find('<svg')
    if svg_start > 0:
        svg_content = svg_content[svg_start:]
    
    existing = db.query(Floor).filter(
        Floor.place == floor_data.place,
        Floor.number == floor_data.number
    ).first()
    
    if existing:
        raise HTTPException(409, f"Этаж {floor_data.number} у объекта '{floor_data.place}' уже существует")
    
    floor = Floor(
        number=floor_data.number,
        place=floor_data.place,
        map=svg_content
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
    current_user: User = Depends(require_admin)
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

@router.post("/rename-object", response_model=dict)
async def rename_object(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Переименовать все этажи объекта"""
    old_place = request.get("old_place")
    new_place = request.get("new_place")
    
    if not old_place or not new_place:
        raise HTTPException(400, "Не указаны старое или новое название")
    
    if old_place == new_place:
        raise HTTPException(400, "Новое название совпадает со старым")
    
    floors = db.query(Floor).filter(Floor.place == old_place).all()
    
    if not floors:
        raise HTTPException(404, f"Объект '{old_place}' не найден")
    
    existing = db.query(Floor).filter(Floor.place == new_place).first()
    if existing:
        raise HTTPException(409, f"Объект с названием '{new_place}' уже существует")
    
    for floor in floors:
        floor.place = new_place
    
    db.commit()
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="ПЕРЕИМЕНОВАНИЕ ОБЪЕКТА",
        text=f"Объект '{old_place}' переименован в '{new_place}' (обновлено {len(floors)} этажей)"
    )
    
    return {"message": f"Объект переименован", "updated_floors": len(floors)}

@router.delete("/{floor_id}", response_model=FloorDeleteResponse)
async def delete_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    cameras = db.query(Camera).filter(Camera.floor_id == floor_id).all()
    cameras_deleted = 0
    
    for camera in cameras:
        detections = db.query(Detection).filter(Detection.camera_id == camera.id).all()
        for detection in detections:
            db.query(Notification).filter(Notification.detection_id == detection.id).delete()
            db.delete(detection)
        db.delete(camera)
        cameras_deleted += 1
    
    areas = db.query(Area).filter(Area.floor_id == floor_id).all()
    areas_deleted = 0
    
    for area in areas:
        db.query(Schedule).filter(Schedule.area_id == area.id).delete()
        db.query(Camera).filter(Camera.area_id == area.id).update({Camera.area_id: None})
        db.delete(area)
        areas_deleted += 1
    
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