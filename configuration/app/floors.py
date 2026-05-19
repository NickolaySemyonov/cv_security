from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from database import get_db
from models import Floor, User, Camera
from schemas import FloorCreate, FloorResponse, CalibrationData, FloorSettingsResponse, FloorUpdate
from security import get_current_user
from pydantic import BaseModel
import re

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
    """Получить этаж по ID"""
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
    """Создать новый этаж"""
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
    return floor


@router.patch("/{floor_id}")
async def update_floor(
    floor_id: int,
    floor_data: FloorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить этаж (при обновлении карты удаляем все камеры)"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    is_map_changed = floor_data.map is not None and floor_data.map != floor.map
    
    update_data = floor_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(floor, field, value)
    
    if is_map_changed:
        # Удаляем все камеры этажа
        cameras = db.query(Camera).filter(Camera.floor_id == floor_id).all()
        cameras_count = len(cameras)
        
        for camera in cameras:
            db.delete(camera)
        
        floor.is_calibrated = False
        floor.calibration_points = None
        floor.calibration_distance = None
        floor.pixels_per_meter = None
        floor.real_width_meters = None
        floor.real_height_meters = None
        
        db.commit()
        
        return {
            "message": f"Этаж обновлён. Удалено {cameras_count} камер, калибровка сброшена.",
            "cameras_deleted": cameras_count
        }
    
    db.commit()
    db.refresh(floor)
    return floor


@router.delete("/{floor_id}")
async def delete_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить этаж по ID"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    db.delete(floor)
    db.commit()
    return {"message": "Этаж успешно удалён"}


@router.patch("/{floor_id}/calibrate")
async def update_calibration(
    floor_id: int,
    calibration_data: CalibrationData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить калибровку этажа (разрешено даже если есть камеры)"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    points = calibration_data.calibration_points
    if len(points) != 2:
        raise HTTPException(400, "Необходимо указать ровно 2 точки для калибровки")
    
    distance_px = ((points[1]["x"] - points[0]["x"]) ** 2 + 
                   (points[1]["y"] - points[0]["y"]) ** 2) ** 0.5
    
    if distance_px == 0:
        raise HTTPException(400, "Расстояние между точками не может быть равно нулю")
    
    pixels_per_meter = distance_px / calibration_data.calibration_distance
    
    svg_width = 800
    svg_height = 600
    
    if floor.map:
        viewbox_match = re.search(r'viewBox="[0-9.]+ [0-9.]+ ([0-9.]+) ([0-9.]+)"', floor.map)
        if viewbox_match:
            svg_width = float(viewbox_match.group(1))
            svg_height = float(viewbox_match.group(2))
        else:
            width_match = re.search(r'width="([0-9.]+)"', floor.map)
            height_match = re.search(r'height="([0-9.]+)"', floor.map)
            if width_match:
                svg_width = float(width_match.group(1))
            if height_match:
                svg_height = float(height_match.group(1))
    
    if abs(points[1]["x"] - points[0]["x"]) > abs(points[1]["y"] - points[0]["y"]):
        real_width_meters = calibration_data.calibration_distance
        real_height_meters = real_width_meters * (svg_height / svg_width)
    else:
        real_height_meters = calibration_data.calibration_distance
        real_width_meters = real_height_meters * (svg_width / svg_height)
    
    floor.calibration_points = calibration_data.calibration_points
    floor.calibration_distance = calibration_data.calibration_distance
    floor.pixels_per_meter = pixels_per_meter
    floor.real_width_meters = real_width_meters
    floor.real_height_meters = real_height_meters
    floor.is_calibrated = calibration_data.is_calibrated
    
    db.commit()
    
    return {
        "message": "Калибровка успешно обновлена",
        "pixels_per_meter": round(pixels_per_meter, 2),
        "real_width_meters": round(real_width_meters, 2),
        "real_height_meters": round(real_height_meters, 2),
        "distance_px": round(distance_px, 2),
        "distance_meters": calibration_data.calibration_distance
    }


@router.delete("/{floor_id}/calibrate")
async def reset_calibration(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Сбросить калибровку этажа и удалить все камеры"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    cameras = db.query(Camera).filter(Camera.floor_id == floor_id).all()
    cameras_count = len(cameras)
    
    for camera in cameras:
        db.delete(camera)
    
    floor.is_calibrated = False
    floor.calibration_points = None
    floor.calibration_distance = None
    floor.pixels_per_meter = None
    floor.real_width_meters = None
    floor.real_height_meters = None
    
    db.commit()
    
    return {
        "message": f"Калибровка сброшена. Удалено {cameras_count} камер.",
        "cameras_deleted": cameras_count
    }


@router.get("/{floor_id}/settings", response_model=FloorSettingsResponse)
async def get_floor_settings(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить настройки калибровки этажа"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    return FloorSettingsResponse(
        is_calibrated=floor.is_calibrated if hasattr(floor, 'is_calibrated') else False,
        calibration_points=floor.calibration_points if hasattr(floor, 'calibration_points') else None,
        calibration_distance=floor.calibration_distance if hasattr(floor, 'calibration_distance') else None,
        pixels_per_meter=floor.pixels_per_meter if hasattr(floor, 'pixels_per_meter') else None,
        real_width_meters=floor.real_width_meters if hasattr(floor, 'real_width_meters') else None,
        real_height_meters=floor.real_height_meters if hasattr(floor, 'real_height_meters') else None
    )