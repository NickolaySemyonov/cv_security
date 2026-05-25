# backend/app/areas.py (новый файл)
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import User, Area, Floor, Camera
from schemas import AreaCreate, AreaResponse, AreaUpdate, CameraResponse
from security import get_current_user
from crud.area import area_crud
from crud.logs import action_logger

router = APIRouter(prefix="/areas", tags=["areas"])


@router.get("/floor/{floor_id}", response_model=List[AreaResponse])
async def get_areas_by_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить все зоны на этаже"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    areas = area_crud.get_by_floor(db, floor_id)
    
    # Добавляем камеры для каждой зоны
    result = []
    for area in areas:
        cameras = db.query(Camera).filter(Camera.area_id == area.id).all()
        result.append(AreaResponse(
            id=area.id,
            type=area.type,
            red_zone=area.red_zone,
            floor_id=area.floor_id,
            cameras=[CameraResponse.model_validate(c) for c in cameras]
        ))
    
    return result


@router.get("/{area_id}", response_model=AreaResponse)
async def get_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить зону по ID"""
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    cameras = db.query(Camera).filter(Camera.area_id == area_id).all()
    
    return AreaResponse(
        id=area.id,
        type=area.type,
        red_zone=area.red_zone,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.post("/", response_model=AreaResponse)
async def create_area(
    area_data: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новую зону"""
    floor = db.query(Floor).filter(Floor.id == area_data.floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    # Проверяем, что камеры существуют и принадлежат этому этажу
    if area_data.camera_ids:
        cameras = db.query(Camera).filter(
            Camera.id.in_(area_data.camera_ids),
            Camera.floor_id == area_data.floor_id
        ).all()
        
        if len(cameras) != len(area_data.camera_ids):
            raise HTTPException(400, "Некоторые камеры не найдены или не принадлежат этому этажу")
    
    area = area_crud.create(db, area_data)
    
    # Логируем
    action_logger.log(
        db,
        user_id=current_user.id,
        title="СОЗДАНИЕ ЗОНЫ",
        text=f"Создана {area.type} зона на этаже {floor.number} у объекта '{floor.place}' с {len(area_data.camera_ids or [])} камерами"
    )
    
    # Получаем камеры для ответа
    cameras = db.query(Camera).filter(Camera.area_id == area.id).all()
    
    return AreaResponse(
        id=area.id,
        type=area.type,
        red_zone=area.red_zone,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.patch("/{area_id}", response_model=AreaResponse)
async def update_area(
    area_id: int,
    area_data: AreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить зону"""
    area = area_crud.update(db, area_id, area_data)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    # Логируем
    action_logger.log(
        db,
        user_id=current_user.id,
        title="ОБНОВЛЕНИЕ ЗОНЫ",
        text=f"Обновлена зона #{area_id}, тип: {area_data.type}, камер: {len(area_data.camera_ids or [])}"
    )
    
    cameras = db.query(Camera).filter(Camera.area_id == area_id).all()
    
    return AreaResponse(
        id=area.id,
        type=area.type,
        red_zone=area.red_zone,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.delete("/{area_id}")
async def delete_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить зону"""
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    floor = db.query(Floor).filter(Floor.id == area.floor_id).first()
    
    area_crud.delete(db, area_id)
    
    # Логируем
    action_logger.log(
        db,
        user_id=current_user.id,
        title="УДАЛЕНИЕ ЗОНЫ",
        text=f"Удалена {area.type} зона с этажа {floor.number if floor else '?'}"
    )
    
    return {"message": "Зона удалена"}


@router.post("/{area_id}/toggle-type")
async def toggle_area_type(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Переключить тип зоны (зелёная/красная)"""
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    new_type = "red" if area.type == "green" else "green"
    area.type = new_type
    area.red_zone = (new_type == "red")
    
    db.commit()
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="ИЗМЕНЕНИЕ ТИПА ЗОНЫ",
        text=f"Зона #{area_id} изменена на {new_type}"
    )
    
    return {"message": f"Тип зоны изменён на {new_type}", "type": new_type}