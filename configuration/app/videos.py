# configuration/app/videos.py
import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from typing import List
from security import get_current_user
from models import User

router = APIRouter(prefix="/videos", tags=["videos"])

# Путь к папке с видео (настройте под свой проект)
VIDEOS_DIRECTORY = "D:/DIPLOM/cv_security/storage/videos"


@router.get("/list")
async def get_videos_list(
    current_user: User = Depends(get_current_user)
):
    """Получить список всех видео файлов из папки"""
    try:
        # Создаём папку, если её нет
        if not os.path.exists(VIDEOS_DIRECTORY):
            os.makedirs(VIDEOS_DIRECTORY, exist_ok=True)
            return {"videos": []}
        
        video_files = []
        for filename in os.listdir(VIDEOS_DIRECTORY):
            # Проверяем расширения видеофайлов
            if filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm', '.mpeg')):
                file_path = os.path.join(VIDEOS_DIRECTORY, filename)
                file_size = os.path.getsize(file_path)
                video_files.append({
                    "name": filename,
                    "url": f"/static/videos/{filename}",
                    "size_mb": round(file_size / (1024 * 1024), 2)
                })
        
        return {"videos": video_files}
    except Exception as e:
        raise HTTPException(500, f"Ошибка получения списка видео: {str(e)}")


@router.get("/{filename}")
async def get_video_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Получить видео файл (альтернативный способ без статической раздачи)"""
    file_path = os.path.join(VIDEOS_DIRECTORY, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "Видео не найдено")
    return FileResponse(file_path, media_type='video/mp4')