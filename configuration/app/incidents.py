from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, Notification, Detection, Camera, Area, Floor
from security import get_current_user
from schemas import IncidentResponse

router = APIRouter(prefix="/incidents", tags=["incidents"])

@router.get("/", response_model=List[IncidentResponse])
async def get_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Получаем уведомления с типом 'red' (нарушения)
    notifications = db.query(Notification).filter(Notification.type == 'red').order_by(Notification.id.desc()).limit(100).all()
    
    incidents = []
    for notif in notifications:
        detection = db.query(Detection).filter(Detection.id == notif.detection_id).first()
        if detection:
            camera = db.query(Camera).filter(Camera.id == detection.camera_id).first()
            area = db.query(Area).filter(Area.id == notif.area_id).first() if notif.area_id else None
            floor = db.query(Floor).filter(Floor.id == (area.floor_id if area else camera.floor_id)).first()
            
            incidents.append({
                "id": notif.id,
                "time": notif.time,
                "area_id": notif.area_id or 0,
                "area_name": f"Зона {notif.area_id}" if notif.area_id else "Неизвестная зона",
                "camera_id": detection.camera_id,
                "info": notif.text,
                "floor_id": floor.id if floor else 0,
                "floor_map": floor.map if floor else "",
                "zone_vertices": area.cameras[0].visible_zone['vertices'] if area and area.cameras else []
            })
    
    return incidents