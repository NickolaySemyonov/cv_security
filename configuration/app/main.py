from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from auth import router as auth_router
from floors import router as floors_router
from cameras import router as cameras_router
from videos import router as videos_router
from logs import router as logs_router 
from areas import router as areas_router
from schedules import router as schedules_router
from users import router as users_router
from incidents import router as incidents_router
from security import get_current_user
from models import User
import os
import asyncio
from datetime import datetime, timedelta
from database import SessionLocal
from models import Area, Schedule
from crud.logs import action_logger
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CV Security API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
)

app.include_router(auth_router)
app.include_router(floors_router)
app.include_router(cameras_router)
app.include_router(videos_router)
app.include_router(areas_router)
app.include_router(logs_router)
app.include_router(schedules_router)
app.include_router(users_router)
app.include_router(incidents_router)

VIDEOS_DIRECTORY = os.getenv("VIDEOS_DIRECTORY", "./storage/videos")
os.makedirs(VIDEOS_DIRECTORY, exist_ok=True)
app.mount("/static/videos", StaticFiles(directory=VIDEOS_DIRECTORY), name="videos")

@app.get("/video-stream")
async def video_stream(url: str):
    import httpx
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            return Response(content=response.content, media_type="video/mp4")
        except httpx.TimeoutException:
            raise HTTPException(408, "Таймаут видео-потока")
        except Exception as e:
            raise HTTPException(404, f"Видео не найдено: {str(e)}")

@app.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"message": f"Привет, {current_user.login}!", "user_id": current_user.id}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

async def schedule_color_updater():
    while True:
        await asyncio.sleep(5)  # Проверка каждые 5 секунд
        db = None
        try:
            db = SessionLocal()
            now = datetime.now()
            
            days_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            current_day = days_en[now.weekday()]
            current_hour = now.hour
            current_minute = now.minute
            current_second = now.second
            current_total = current_hour * 3600 + current_minute * 60 + current_second
            
            areas = db.query(Area).filter(Area.disabled == False).all()
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
                    
                    start_total = start.hour * 3600 + start.minute * 60 + start.second
                    end_total = end.hour * 3600 + end.minute * 60 + end.second
                    
                    # Добавляем 1 минуту к концу интервала (до следующей минуты)
                    # Например: 00:19 -> 00:20 (60 секунд)
                    end_total_extended = end_total + 60  # +1 минута
                    
                    # Интервал не переходит через полночь
                    if start_total <= end_total:
                        # Красная зона: от start_total до end_total + 1 минута
                        if start_total <= current_total <= end_total_extended:
                            is_active = True
                            break
                    else:
                        # Интервал переходит через полночь
                        # Красная зона: от start_total до 24:00 + 1 минута И от 00:00 до end_total + 1 минута
                        end_total_extended = end_total + 60
                        if current_total >= start_total or current_total <= end_total_extended:
                            is_active = True
                            break
                
                target_type = "red" if is_active else "green"
                
                if area.type != target_type:
                    old_type = area.type
                    area.type = target_type
                    updated_count += 1
                    
                    print(f"[{now.strftime('%H:%M:%S')}] Зона #{area.id}: {old_type} -> {target_type}")
                    
                    try:
                        action_logger.log(
                            db,
                            user_id=None,
                            title="АВТОМАТИЧЕСКАЯ СМЕНА ЦВЕТА ЗОНЫ",
                            text=f"Зона #{area.id} автоматически изменена с {old_type} на {target_type} по расписанию"
                        )
                    except Exception as log_err:
                        print(f"Ошибка логирования: {log_err}")
            
            if updated_count > 0:
                db.commit()
                print(f"[{now.strftime('%H:%M:%S')}] Автоматически обновлено {updated_count} зон")
            
        except Exception as e:
            print(f"Ошибка обновления цветов зон: {e}")
            if db:
                db.rollback()
        finally:
            if db:
                db.close()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(schedule_color_updater())

@app.on_event("shutdown")
async def shutdown_event():
    print("\n🛑 Сервер остановлен")