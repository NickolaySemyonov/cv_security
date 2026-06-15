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
    notifications = db.query(Notification).filter(Notification.type == 'red').order_by(Notification.id.desc()).limit(100).all()
    
    incidents = []
    for notif in notifications:
        detection = db.query(Detection).filter(Detection.id == notif.detection_id).first()
        if not detection:
            continue
        
        camera = db.query(Camera).filter(Camera.id == detection.camera_id).first()
        if not camera:
            continue
        
        area = db.query(Area).filter(Area.id == camera.area_id).first()
        
        floor = None
        floor_number = None
        if area:
            floor = db.query(Floor).filter(Floor.id == area.floor_id).first()
            if floor:
                floor_number = floor.number
        else:
            floor = db.query(Floor).filter(Floor.id == camera.floor_id).first()
            if floor:
                floor_number = floor.number
        
        zone_polygons = []
        if area:
            for cam in area.cameras:
                if cam.visible_zone and cam.visible_zone.get('vertices'):
                    vertices = cam.visible_zone.get('vertices', [])
                    if len(vertices) >= 4:
                        zone_polygons.append(vertices)
        
        incidents.append({
            "id": notif.id,
            "time": detection.time,
            "area_id": area.id if area else 0,
            "area_name": f"Зона {area.id}" if area else "Неизвестная зона",
            "camera_id": detection.camera_id,
            "info": notif.text_,
            "floor_id": floor.id if floor else 0,
            "floor_number": floor_number if floor_number else 0,
            "floor_map": floor.map if floor else "",
            "zone_polygons": zone_polygons
        })
    
    return incidents