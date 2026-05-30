import bcrypt
from sqlalchemy.orm import Session
from models import User
from schemas import UserLogin, UserCreate

class CRUDUser:
    @staticmethod
    def get_by_login(db: Session, login: str) -> User | None:
        return db.query(User).filter(User.login == login).first()
    
    @staticmethod
    def get_by_id(db: Session, user_id: int) -> User | None:
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        try:
            return bcrypt.checkpw(
                plain_password.encode('utf-8'),
                hashed_password.encode('utf-8')
            )
        except Exception as e:
            print(f"Ошибка проверки пароля: {e}")
            return False
    
    @staticmethod
    def authenticate(db: Session, login_data: UserLogin) -> User | None:
        user = CRUDUser.get_by_login(db, login=login_data.login)
        if not user:
            return None
        if not CRUDUser.verify_password(login_data.password, user.password_hash):
            return None
        return user
    
    @staticmethod
    def create_operator(db: Session, user_data: UserCreate) -> User:
        hashed = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
        user = User(
            login=user_data.login,
            password_hash=hashed.decode('utf-8'),
            role='operator'
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def get_all_operators(db: Session) -> list[User]:
        return db.query(User).filter(User.role == 'operator').all()

user = CRUDUser()