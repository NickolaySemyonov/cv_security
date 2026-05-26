# schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


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

class FloorUpdate(BaseModel):
    number: Optional[int] = Field(None, ge=0, description="Номер этажа")
    place: Optional[str] = Field(None, min_length=1, max_length=100, description="Название объекта")
    map: Optional[str] = Field(None, description="SVG карта этажа")
    
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


class CameraBase(BaseModel):
    position: Dict[str, float]
    visible_zone: Dict[str, Any]
    is_active: bool = True
    is_configured: bool = False  
    points_of_homography: Optional[Dict[str, Any]] = None
    floor_id: int
    video_stream: Optional[str] = None
    area_id: Optional[int] = None 

class CameraCreate(CameraBase):
    pass

class CameraUpdate(BaseModel):
    position: Optional[Dict[str, float]] = None
    visible_zone: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    points_of_homography: Optional[Dict[str, Any]] = None
    video_stream: Optional[str] = None
    area_id: Optional[int] = None  

class CameraResponse(CameraBase):
    id: int
    is_configured: bool = False
    
    class Config:
        from_attributes = True

class HomographyData(BaseModel):
    src_points: List[List[float]]  
    dst_points: List[List[float]]  


class ActionResponse(BaseModel):
    id: int
    time: datetime
    title: str
    text: str
    user_id: int
    user_login: str
    
    class Config:
        from_attributes = True


class ActionLogsResponse(BaseModel):
    items: List[ActionResponse]
    total: int
    page: int
    limit: int
    pages: int


class AreaCreate(BaseModel):
    type: str = "green" 
    floor_id: int
    camera_ids: List[int] = []  


class AreaUpdate(BaseModel):
    type: Optional[str] = None
    camera_ids: Optional[List[int]] = None


class AreaResponse(BaseModel):
    id: int
    type: str
    red_zone: bool
    floor_id: int
    cameras: List[CameraResponse] = []
    
    class Config:
        from_attributes = True


class WeekDay(str, Enum):
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"
    SATURDAY = "Saturday"
    SUNDAY = "Sunday"

class ScheduleCreate(BaseModel):
    start_time: str  # формат "HH:MM"
    end_time: str    # формат "HH:MM"
    day: WeekDay
    area_id: int

class ScheduleResponse(BaseModel):
    id: int
    start_time: str
    end_time: str
    day: WeekDay
    area_id: int
    
    class Config:
        from_attributes = True

class ScheduleUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    day: Optional[WeekDay] = None

class AreaWithScheduleResponse(AreaResponse):
    schedule: List[ScheduleResponse] = []