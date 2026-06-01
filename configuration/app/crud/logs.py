from sqlalchemy.orm import Session
from models import Action
from datetime import datetime
from typing import Optional

class CRUDAction:
    @staticmethod
    def log(db: Session, user_id: Optional[int], title: str, text: str) -> Action:
        """Создать запись лога
        - user_id: ID пользователя или None для системных событий
        """
        from models import User
        
        final_user_id = None
        
        if user_id is not None:
            user_exists = db.query(User).filter(User.id == user_id).first()
            if user_exists:
                final_user_id = user_id
        
        action = Action(
            user_id=final_user_id,
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