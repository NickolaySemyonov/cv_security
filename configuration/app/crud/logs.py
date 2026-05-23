# backend/app/crud/logs.py (новый файл)
from sqlalchemy.orm import Session
from models import Action
from datetime import datetime

class CRUDAction:
    @staticmethod
    def log(db: Session, user_id: int, title: str, text: str) -> Action:
        """Создать запись лога"""
        action = Action(
            user_id=user_id,
            title=title,
            text_=text,
            time=datetime.utcnow()
        )
        db.add(action)
        db.commit()
        db.refresh(action)
        return action
    
    @staticmethod
    def get_user_actions(db: Session, user_id: int, limit: int = 50):
        return db.query(Action).filter(Action.user_id == user_id).order_by(Action.time.desc()).limit(limit).all()

action_logger = CRUDAction()