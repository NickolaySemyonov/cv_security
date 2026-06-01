import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from typing import List
from pathlib import Path
from dotenv import load_dotenv
from security import get_current_user
from models import User

# Загружаем .env из корня проекта
env_path = Path(__file__).parent.parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

router = APIRouter(prefix="/videos", tags=["videos"])

VIDEOS_DIRECTORY = os.getenv("VIDEOS_DIRECTORY", "./storage/videos")

@router.get("/list")
async def get_videos_list(
    current_user: User = Depends(get_current_user)
):
    try:
        if not os.path.exists(VIDEOS_DIRECTORY):
            os.makedirs(VIDEOS_DIRECTORY, exist_ok=True)
            return {"videos": []}
        
        video_files = []
        for filename in os.listdir(VIDEOS_DIRECTORY):
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
    file_path = os.path.join(VIDEOS_DIRECTORY, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "Видео не найдено")
    return FileResponse(file_path, media_type='video/mp4')