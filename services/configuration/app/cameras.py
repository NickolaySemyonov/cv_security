from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import User, Area, Floor, Camera, Schedule, Detection, Notification
from schemas import CameraCreate, CameraResponse, CameraUpdate
from security import get_current_user, require_operator_or_admin, require_admin
from crud.logs import action_logger

router = APIRouter(prefix="/cameras", tags=["cameras"])

@router.get("/floor/{floor_id}", response_model=List[CameraResponse])
async def get_cameras_by_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    cameras = db.query(Camera).filter(Camera.floor_id == floor_id).all()
    return cameras

@router.get("/floor/{floor_id}/ids")
async def get_camera_ids_by_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cameras = db.query(Camera.id).filter(Camera.floor_id == floor_id).all()
    return [camera.id for camera in cameras]

@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
    floor = db.query(Floor).filter(Floor.id == camera_data.floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    camera = Camera(
        position=camera_data.position,
        visible_zone=camera_data.visible_zone,
        is_configured=False,
        points_of_homography=None,
        floor_id=camera_data.floor_id,
        area_id=None,  # Новая камера не привязана к зоне
        video_stream=camera_data.video_stream,
        frame_shape=None,
        rotation=camera_data.rotation
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="СОЗДАНИЕ КАМЕРЫ",
        text=f"Создана камера #{camera.id} на этаже {floor.number} у объекта '{floor.place}'"
    )
    
    return camera

@router.patch("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: int,
    camera_data: CameraUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(404, "Камера не найдена")
    
    update_data = camera_data.dict(exclude_unset=True)
    
    old_is_configured = camera.is_configured
    old_area_id = camera.area_id
    
    is_zone_changed = 'visible_zone' in update_data
    is_position_changed = 'position' in update_data
    is_reset_calibration = update_data.get('reset_calibration', False)
    
    # Если переместили камеру, то сбрасываем для перекалибровки
    if is_zone_changed or is_position_changed or is_reset_calibration:
        update_data['is_configured'] = False
        update_data['points_of_homography'] = None
        update_data['frame_shape'] = None
        # при сбросе калибровки отвязываем камеру от зоны
        update_data['area_id'] = None
    
    for field, value in update_data.items():
        setattr(camera, field, value)
    
    # Если камер в зоне не осталось, то удаляем зону
    if old_area_id is not None and camera.area_id is None:
        remaining_cameras = db.query(Camera).filter(
            Camera.area_id == old_area_id,
            Camera.id != camera_id
        ).count()
        
        if remaining_cameras == 0:
            db.query(Schedule).filter(Schedule.area_id == old_area_id).delete()
            area = db.query(Area).filter(Area.id == old_area_id).first()
            if area:
                db.delete(area)
                action_logger.log(
                    db,
                    user_id=current_user.id,
                    title="АВТОМАТИЧЕСКОЕ УДАЛЕНИЕ ЗОНЫ",
                    text=f"Зона #{old_area_id} автоматически удалена, так как в ней не осталось камер"
                )
        
        action_logger.log(
            db,
            user_id=current_user.id,
            title="ОТВЯЗКА КАМЕРЫ ОТ ЗОНЫ",
            text=f"Камера #{camera_id} отвязана от зоны #{old_area_id} из-за сброса калибровки"
        )
    
    db.commit()
    db.refresh(camera)
    
    floor = db.query(Floor).filter(Floor.id == camera.floor_id).first()
    
    if is_zone_changed or is_position_changed:
        action_logger.log(
            db,
            user_id=current_user.id,
            title="ПЕРЕМЕЩЕНИЕ КАМЕРЫ",
            text=f"Камера #{camera_id} перемещена на этаже {floor.number if floor else '?'} у объекта '{floor.place if floor else '?'}', данные калибровки сброшены, камера отвязана от зоны"
        )
    else:
        action_logger.log(
            db,
            user_id=current_user.id,
            title="ОБНОВЛЕНИЕ КАМЕРЫ",
            text=f"Обновлена камера #{camera_id} на этаже {floor.number if floor else '?'} у объекта '{floor.place if floor else '?'}'"
        )
    
    return camera

@router.patch("/{camera_id}/homography")
async def update_camera_homography(
    camera_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(404, "Камера не найдена")
    
    floor = db.query(Floor).filter(Floor.id == camera.floor_id).first()
    
    camera.points_of_homography = data.get("points_of_homography")
    camera.video_stream = data.get("stream_url", camera.video_stream)
    camera.frame_shape = data.get("frame_shape")
    camera.is_configured = data.get("is_configured", True)
    
    db.commit()
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="НАСТРОЙКА ГОМОГРАФИИ",
        text=f"Настроена гомография для камеры #{camera_id} на этаже {floor.number if floor else '?'} у объекта '{floor.place if floor else '?'}'"
    )
    
    return {"message": "Гомография сохранена"}

@router.delete("/{camera_id}")
async def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(404, "Камера не найдена")
    
    floor = db.query(Floor).filter(Floor.id == camera.floor_id).first()
    area_id = camera.area_id
    
    detections = db.query(Detection).filter(Detection.camera_id == camera_id).all()
    for detection in detections:
        db.query(Notification).filter(Notification.detection_id == detection.id).delete()
        db.delete(detection)
    
    db.delete(camera)
    db.commit()
    
    if area_id:
        remaining_cameras = db.query(Camera).filter(Camera.area_id == area_id).count()
        if remaining_cameras == 0:
            db.query(Schedule).filter(Schedule.area_id == area_id).delete()
            area = db.query(Area).filter(Area.id == area_id).first()
            if area:
                db.delete(area)
                db.commit()
                action_logger.log(
                    db,
                    user_id=current_user.id,
                    title="АВТОМАТИЧЕСКОЕ УДАЛЕНИЕ ЗОНЫ",
                    text=f"Зона #{area_id} автоматически удалена, так как в ней не осталось камер"
                )
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="УДАЛЕНИЕ КАМЕРЫ",
        text=f"Удалена камера #{camera_id} с этажа {floor.number if floor else '?'} у объекта '{floor.place if floor else '?'}'"
    )
    
    return {"message": "Камера успешно удалена"}