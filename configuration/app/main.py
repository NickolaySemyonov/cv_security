from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from auth import router as auth_router
from floors import router as floors_router
from cameras import router as cameras_router
from videos import router as videos_router
from logs import router as logs_router 
from areas import router as areas_router
from schedules import router as schedules_router
from security import get_current_user
from models import User
import os
import asyncio
from datetime import datetime
from database import SessionLocal
from models import Area, Schedule
from crud.logs import action_logger

app = FastAPI(title="CV Security API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(floors_router)
app.include_router(cameras_router)
app.include_router(videos_router)
app.include_router(areas_router)
app.include_router(logs_router)
app.include_router(schedules_router)


VIDEOS_DIRECTORY = "D:/DIPLOM/cv_security/storage/videos"
os.makedirs(VIDEOS_DIRECTORY, exist_ok=True)
app.mount("/static/videos", StaticFiles(directory=VIDEOS_DIRECTORY), name="videos")

@app.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"message": f"Привет, {current_user.login}!", "user_id": current_user.id}

@app.get("/health")
async def health_check():
    return {"status": "ok"}


async def schedule_color_updater():
    """Фоновая задача для обновления цветов зон каждую секунду"""
    while True:
        await asyncio.sleep(1)  # Проверяем КАЖДУЮ СЕКУНДУ
        
        try:
            db = SessionLocal()
            now = datetime.now()
            
            days_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            current_day = days_en[now.weekday()]
            current_hour = now.hour
            current_minute = now.minute
            current_second = now.second
            current_total_seconds = current_hour * 3600 + current_minute * 60 + current_second
            
            # Логируем только каждую 30-ю секунду, чтобы не заспамить консоль
            if current_second % 30 == 0:
                print(f"[{now.strftime('%H:%M:%S')}] 🔍 Проверка расписания...")
            
            areas = db.query(Area).all()
            updated_count = 0
            
            for area in areas:
                schedules = db.query(Schedule).filter(
                    Schedule.area_id == area.id,
                    Schedule.day == current_day
                ).all()
                
                is_active = False
                for schedule in schedules:
                    start = schedule.start_time
                    end = schedule.end_time
                    
                    if hasattr(start, 'tzinfo') and start.tzinfo is not None:
                        start = start.replace(tzinfo=None)
                    if hasattr(end, 'tzinfo') and end.tzinfo is not None:
                        end = end.replace(tzinfo=None)
                    
                    start_seconds = start.hour * 3600 + start.minute * 60 + start.second
                    end_seconds = end.hour * 3600 + end.minute * 60 + end.second
                    
                    if start_seconds <= current_total_seconds <= end_seconds:
                        is_active = True
                        break
                
                target_type = "red" if is_active else "green"
                
                if area.type != target_type:
                    area.type = target_type
                    area.red_zone = (target_type == "red")
                    updated_count += 1
                    print(f"[{now.strftime('%H:%M:%S')}] 🔄 Зона #{area.id}: -> {target_type}")
            
            if updated_count > 0:
                db.commit()
                print(f"[{now.strftime('%H:%M:%S')}] ✅ Обновлено {updated_count} зон")
            
            db.close()
        except Exception as e:
            print(f"❌ Ошибка обновления цветов зон: {e}")


@app.on_event("startup")
async def startup_event():
    """Запуск фоновой задачи при старте сервера"""
    print("\n" + "="*50)
    print("🚀 ЗАПУСК СЕРВЕРА")
    print("="*50)
    asyncio.create_task(schedule_color_updater())
    print("✅ Фоновая задача запущена (проверка каждую секунду)")
    print("="*50 + "\n")


@app.on_event("shutdown")
async def shutdown_event():
    """Остановка сервера"""
    print("\n🛑 Сервер остановлен")