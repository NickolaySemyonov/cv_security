# create_user_fixed.py
import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User

DATABASE_URL = "postgresql://postgres:1234@localhost:5432/kontur"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_user(login: str, password: str):
    db = SessionLocal()
    try:
        # Проверяем существование
        existing = db.query(User).filter(User.login == login).first()
        if existing:
            print(f"❌ Пользователь {login} уже существует")
            return False
        
        # Хэшируем пароль
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        hashed_str = hashed.decode('utf-8')
        
        # Создаем пользователя
        new_user = User(login=login, password_hash=hashed_str)
        db.add(new_user)
        db.commit()
        
        print(f"✅ Пользователь {login} успешно создан!")
        print(f"Пароль: {password}")
        print(f"Хэш: {hashed_str}")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def test_login(login: str, password: str):
    """Тест входа"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.login == login).first()
        if not user:
            print(f"❌ Пользователь {login} не найден")
            return False
        
        is_valid = bcrypt.checkpw(
            password.encode('utf-8'),
            user.password_hash.encode('utf-8')
        )
        
        if is_valid:
            print(f"✅ Пароль для {login} верный!")
        else:
            print(f"❌ Пароль для {login} неверный!")
        return is_valid
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) == 3:
        # Создание пользователя
        create_user(sys.argv[1], sys.argv[2])
        # Тестируем вход
        test_login(sys.argv[1], sys.argv[2])
    else:
        # Создаем тестового пользователя
        create_user("admin", "admin123")
        test_login("admin", "admin123")