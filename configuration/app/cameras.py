# cameras.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Camera, Floor, User
from schemas import CameraCreate, CameraResponse, CameraUpdate
from security import get_current_user

router = APIRouter(prefix="/cameras", tags=["cameras"])


@router.get("/floor/{floor_id}", response_model=List[CameraResponse])
async def get_cameras_by_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить все камеры этажа"""
    cameras = db.query(Camera).filter(Camera.floor_id == floor_id).all()
    return cameras


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить камеру по ID"""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(404, "Камера не найдена")
    return camera


@router.post("/", response_model=CameraResponse)
async def create_camera(
    camera_data: CameraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новую камеру"""
    floor = db.query(Floor).filter(Floor.id == camera_data.floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    camera = Camera(
        position=camera_data.position,
        visible_zone=camera_data.visible_zone,
        is_active=camera_data.is_active,
        is_configured=camera_data.is_configured,
        points_of_homography=camera_data.points_of_homography,
        floor_id=camera_data.floor_id,
        area_id=camera_data.area_id
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


@router.patch("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: int,
    camera_data: CameraUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить камеру"""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(404, "Камера не найдена")
    
    update_data = camera_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camera, field, value)
    
    db.commit()
    db.refresh(camera)
    return camera


@router.patch("/{camera_id}/homography")
async def update_camera_homography(
    camera_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить точки гомографии камеры"""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(404, "Камера не найдена")
    
    camera.points_of_homography = data.get("points_of_homography")
    camera.is_configured = data.get("is_configured", True)
    
    db.commit()
    
    return {"message": "Гомография сохранена"}


@router.delete("/{camera_id}")
async def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить камеру"""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(404, "Камера не найдена")
    
    db.delete(camera)
    db.commit()
    return {"message": "Камера успешно удалена"}