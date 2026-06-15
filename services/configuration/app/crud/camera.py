from sqlalchemy.orm import Session
from models import Camera

class CRUDCamera:
    @staticmethod
    def create(db: Session, camera_data: dict, floor_id: int) -> Camera:
        camera = Camera(
            position=camera_data.get('position'),
            visible_zone=camera_data.get('visible_zone'),
            is_configured=False,
            points_of_homography=None,
            floor_id=floor_id,
            area_id=None,
            video_stream=None,
            frame_shape=None,
            rotation=camera_data.get('rotation', 0)
        )
        db.add(camera)
        db.commit()
        db.refresh(camera)
        return camera
    
    @staticmethod
    def get_by_floor(db: Session, floor_id: int):
        return db.query(Camera).filter(Camera.floor_id == floor_id).all()
    
    @staticmethod
    def delete_by_floor(db: Session, floor_id: int) -> int:
        deleted = db.query(Camera).filter(Camera.floor_id == floor_id).delete()
        db.commit()
        return deleted

camera_crud = CRUDCamera()