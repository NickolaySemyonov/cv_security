# floors.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from database import get_db
from models import Floor, User
from schemas import FloorCreate, FloorResponse, CalibrationData, FloorSettingsResponse
from security import get_current_user
from pydantic import BaseModel
import re

router = APIRouter(prefix="/floors", tags=["floors"])




# ========== ЭНДПОИНТЫ ==========

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
async def calibrate_floor(
    floor_id: int,
    calibration_data: CalibrationData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Калибровка этажа: задание масштаба карты"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    # Проверяем, что переданы 2 точки
    points = calibration_data.calibration_points
    if len(points) != 2:
        raise HTTPException(400, "Необходимо указать ровно 2 точки для калибровки")
    
    # Вычисляем расстояние между точками в пикселях
    distance_px = ((points[1]["x"] - points[0]["x"]) ** 2 + 
                   (points[1]["y"] - points[0]["y"]) ** 2) ** 0.5
    
    if distance_px == 0:
        raise HTTPException(400, "Расстояние между точками не может быть равно нулю")
    
    # Вычисляем количество пикселей на метр
    pixels_per_meter = distance_px / calibration_data.calibration_distance
    
    # Сохраняем данные калибровки
    floor.calibration_points = calibration_data.calibration_points
    floor.calibration_distance = calibration_data.calibration_distance
    floor.pixels_per_meter = pixels_per_meter
    floor.is_calibrated = calibration_data.is_calibrated
    
    db.commit()
    
    return {
        "message": "Калибровка успешно сохранена",
        "pixels_per_meter": round(pixels_per_meter, 2),
        "distance_px": round(distance_px, 2),
        "distance_meters": calibration_data.calibration_distance
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
        pixels_per_meter=floor.pixels_per_meter if hasattr(floor, 'pixels_per_meter') else None
    )


@router.delete("/{floor_id}/calibrate")
async def reset_calibration(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Сбросить калибровку этажа"""
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    floor.is_calibrated = False
    floor.calibration_points = None
    floor.calibration_distance = None
    floor.pixels_per_meter = None
    
    db.commit()
    
    return {"message": "Калибровка успешно сброшена"}