# schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict

class UserLogin(BaseModel):
    login: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4)

class UserResponse(BaseModel):
    id: int
    login: str
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str 
    token_type: str = "bearer"
    user: UserResponse

class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class FloorCreate(BaseModel):
    number: int = Field(..., ge=0, description="Номер этажа")
    place: str = Field(..., min_length=1, max_length=100, description="Название объекта")
    map: str = Field(default='<svg width="800" height="600" viewBox="0 0 800 600" style="background-color: #f0f0f0"></svg>', description="SVG карта этажа")

class FloorResponse(BaseModel):
    id: int
    number: int
    place: str
    map: str
    is_calibrated: bool = False  
    
    class Config:
        from_attributes = True

class CalibrationData(BaseModel):
    calibration_points: List[Dict[str, float]]
    calibration_distance: float
    is_calibrated: bool = True

class FloorSettingsResponse(BaseModel):
    is_calibrated: bool
    calibration_points: Optional[List[Dict[str, float]]] = None
    calibration_distance: Optional[float] = None
    pixels_per_meter: Optional[float] = None
    real_width_meters: Optional[float] = None
    real_height_meters: Optional[float] = None