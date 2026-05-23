# configuration/app/main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from auth import router as auth_router
from floors import router as floors_router
from cameras import router as cameras_router
from videos import router as videos_router
from logs import router as logs_router 
from security import get_current_user
from models import User
import os

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
app.include_router(logs_router)

VIDEOS_DIRECTORY = "D:/DIPLOM/cv_security/storage/videos"
os.makedirs(VIDEOS_DIRECTORY, exist_ok=True)
app.mount("/static/videos", StaticFiles(directory=VIDEOS_DIRECTORY), name="videos")

@app.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"message": f"Привет, {current_user.login}!", "user_id": current_user.id}

@app.get("/health")
async def health_check():
    return {"status": "ok"}