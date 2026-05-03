# main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from auth import router as auth_router
from security import get_current_user 
from models import User
from floors import router as floors_router

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

@app.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"message": f"Привет, {current_user.login}!", "user_id": current_user.id}

@app.get("/health")
async def health_check():
    return {"status": "ok"}