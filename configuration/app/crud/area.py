# backend/app/crud/area.py (новый файл)
from sqlalchemy.orm import Session
from typing import List, Optional
from models import Area, Camera
from schemas import AreaCreate, AreaUpdate

class CRUDArea:
    @staticmethod
    def create(db: Session, area_data: AreaCreate) -> Area:
        """Создать новую зону"""
        area = Area(
            type=area_data.type,
            red_zone=area_data.type == "red",
            floor_id=area_data.floor_id
        )
        db.add(area)
        db.commit()
        db.refresh(area)
        
        # Добавляем камеры в зону
        if area_data.camera_ids:
            cameras = db.query(Camera).filter(Camera.id.in_(area_data.camera_ids)).all()
            for camera in cameras:
                camera.area_id = area.id
            db.commit()
        
        return area
    
    @staticmethod
    def get_by_id(db: Session, area_id: int) -> Optional[Area]:
        return db.query(Area).filter(Area.id == area_id).first()
    
    @staticmethod
    def get_by_floor(db: Session, floor_id: int) -> List[Area]:
        return db.query(Area).filter(Area.floor_id == floor_id).all()
    
    @staticmethod
    def update(db: Session, area_id: int, area_data: AreaUpdate) -> Optional[Area]:
        area = CRUDArea.get_by_id(db, area_id)
        if not area:
            return None
        
        if area_data.type:
            area.type = area_data.type
            area.red_zone = area_data.type == "red"
        
        if area_data.camera_ids is not None:
            # Отвязываем все камеры от этой зоны
            db.query(Camera).filter(Camera.area_id == area_id).update({Camera.area_id: None})
            
            # Привязываем новые камеры
            cameras = db.query(Camera).filter(Camera.id.in_(area_data.camera_ids)).all()
            for camera in cameras:
                camera.area_id = area_id
        
        db.commit()
        db.refresh(area)
        return area
    
    @staticmethod
    def delete(db: Session, area_id: int) -> bool:
        area = CRUDArea.get_by_id(db, area_id)
        if not area:
            return False
        
        # Отвязываем камеры
        db.query(Camera).filter(Camera.area_id == area_id).update({Camera.area_id: None})
        
        db.delete(area)
        db.commit()
        return True
    
    @staticmethod
    def get_cameras_in_area(db: Session, area_id: int) -> List[Camera]:
        return db.query(Camera).filter(Camera.area_id == area_id).all()

area_crud = CRUDArea()